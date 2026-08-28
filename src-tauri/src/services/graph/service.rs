use crate::models::graph::{GraphEdge, GraphFilter, GraphNode, WorkspaceGraphData};
use rusqlite::Connection;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;

pub fn get_workspace_graph(
    conn: &Connection,
    filter: Option<GraphFilter>,
) -> Result<WorkspaceGraphData, String> {
    let filter = filter.unwrap_or_default();
    let include_blocks = filter.include_blocks.unwrap_or(false);
    let include_tags = filter.include_tags.unwrap_or(false);
    let search_q = filter
        .search_query
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());

    let mut nodes: Vec<GraphNode> = Vec::new();
    let mut edges: Vec<GraphEdge> = Vec::new();
    let mut node_degree: HashMap<String, usize> = HashMap::new();
    let mut file_path_to_id: HashMap<String, i64> = HashMap::new();

    // 1. Fetch all active files
    let mut stmt = conn
        .prepare(
            "SELECT id, relative_path, file_name 
             FROM files 
             WHERE is_deleted = 0 
             ORDER BY relative_path ASC;",
        )
        .map_err(|e| format!("Failed to query files for graph: {e}"))?;

    let file_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to read file rows: {e}"))?;

    for row in file_rows.flatten() {
        let (file_id, rel_path, file_name) = row;
        file_path_to_id.insert(rel_path.clone(), file_id);

        let group = Path::new(&rel_path)
            .parent()
            .and_then(|p| p.to_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("root")
            .to_string();

        nodes.push(GraphNode {
            id: rel_path.clone(),
            label: file_name.replace(".md", ""),
            node_type: "note".to_string(),
            path: rel_path,
            block_id: None,
            degree: 0,
            group,
        });
    }

    // 2. Fetch all forward links
    let mut link_stmt = conn
        .prepare(
            "SELECT f.relative_path, l.target_relative_path, l.target_block_id, l.link_type 
             FROM links l
             JOIN files f ON l.source_file_id = f.id
             WHERE l.is_broken = 0;",
        )
        .map_err(|e| format!("Failed to query links for graph: {e}"))?;

    let link_rows = link_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| format!("Failed to read link rows: {e}"))?;

    for row in link_rows.flatten() {
        let (source_path, target_path, target_block_id, _link_type) = row;

        // Normal file-to-file link
        if !target_path.is_empty() && file_path_to_id.contains_key(&source_path) {
            // Target can end with or without .md
            let normalized_target = if file_path_to_id.contains_key(&target_path) {
                target_path.clone()
            } else {
                let with_md = format!("{target_path}.md");
                if file_path_to_id.contains_key(&with_md) {
                    with_md
                } else {
                    target_path.clone()
                }
            };

            if file_path_to_id.contains_key(&normalized_target) {
                let edge_type = if target_block_id.is_some() {
                    "block_ref"
                } else {
                    "wikilink"
                };

                edges.push(GraphEdge {
                    source: source_path.clone(),
                    target: normalized_target.clone(),
                    edge_type: edge_type.to_string(),
                });

                *node_degree.entry(source_path).or_insert(0) += 1;
                *node_degree.entry(normalized_target).or_insert(0) += 1;
            }
        }
    }

    // 3. Optional: Include Tags
    if include_tags {
        let mut tag_stmt = conn
            .prepare(
                "SELECT t.name, f.relative_path 
                 FROM tags t
                 JOIN file_tags ft ON t.id = ft.tag_id
                 JOIN files f ON ft.file_id = f.id
                 WHERE f.is_deleted = 0;",
            )
            .map_err(|e| format!("Failed to query tags for graph: {e}"))?;

        let tag_rows = tag_stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Failed to read tag rows: {e}"))?;

        let mut seen_tags: HashSet<String> = HashSet::new();

        for row in tag_rows.flatten() {
            let (tag_name, file_rel_path) = row;
            let tag_node_id = format!("tag:{tag_name}");

            if !seen_tags.contains(&tag_name) {
                seen_tags.insert(tag_name.clone());
                nodes.push(GraphNode {
                    id: tag_node_id.clone(),
                    label: format!("#{tag_name}"),
                    node_type: "tag".to_string(),
                    path: String::new(),
                    block_id: None,
                    degree: 0,
                    group: "tag".to_string(),
                });
            }

            edges.push(GraphEdge {
                source: file_rel_path.clone(),
                target: tag_node_id.clone(),
                edge_type: "tag".to_string(),
            });

            *node_degree.entry(file_rel_path).or_insert(0) += 1;
            *node_degree.entry(tag_node_id).or_insert(0) += 1;
        }
    }

    // 4. Optional: Include Anchored Blocks
    if include_blocks {
        let mut block_stmt = conn
            .prepare(
                "SELECT b.block_id, b.text_preview, f.relative_path 
                 FROM blocks b
                 JOIN files f ON b.file_id = f.id
                 WHERE f.is_deleted = 0 AND b.block_id NOT LIKE 'bk-0000%';",
            )
            .map_err(|e| format!("Failed to query blocks for graph: {e}"))?;

        let block_rows = block_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| format!("Failed to read block rows: {e}"))?;

        for row in block_rows.flatten() {
            let (block_id, text_preview, file_path) = row;
            let block_node_id = format!("{file_path}#^{block_id}");

            nodes.push(GraphNode {
                id: block_node_id.clone(),
                label: if text_preview.len() > 24 {
                    format!("{}...", &text_preview[..21])
                } else {
                    text_preview
                },
                node_type: "block".to_string(),
                path: file_path.clone(),
                block_id: Some(block_id),
                degree: 1,
                group: "block".to_string(),
            });

            edges.push(GraphEdge {
                source: file_path.clone(),
                target: block_node_id.clone(),
                edge_type: "block_ref".to_string(),
            });

            *node_degree.entry(file_path).or_insert(0) += 1;
            *node_degree.entry(block_node_id).or_insert(0) += 1;
        }
    }

    // Update node degrees
    for node in &mut nodes {
        if let Some(&deg) = node_degree.get(&node.id) {
            node.degree = deg;
        }
    }

    // Optional Search Filter
    if let Some(ref q) = search_q {
        let matched_ids: HashSet<String> = nodes
            .iter()
            .filter(|n| n.label.to_lowercase().contains(q) || n.path.to_lowercase().contains(q))
            .map(|n| n.id.clone())
            .collect();

        nodes.retain(|n| matched_ids.contains(&n.id));
        edges.retain(|e| matched_ids.contains(&e.source) && matched_ids.contains(&e.target));
    }

    Ok(WorkspaceGraphData { nodes, edges })
}

pub fn get_local_graph(
    conn: &Connection,
    relative_path: &str,
    depth: u32,
) -> Result<WorkspaceGraphData, String> {
    let all = get_workspace_graph(
        conn,
        Some(GraphFilter {
            include_blocks: Some(true),
            include_tags: Some(true),
            search_query: None,
        }),
    )?;

    // Adjacency map
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &all.edges {
        adj.entry(edge.source.clone())
            .or_default()
            .push(edge.target.clone());
        adj.entry(edge.target.clone())
            .or_default()
            .push(edge.source.clone());
    }

    // BFS up to depth hops
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, u32)> = VecDeque::new();

    let start_node = relative_path.to_string();
    visited.insert(start_node.clone());
    queue.push_back((start_node, 0));

    while let Some((curr, curr_depth)) = queue.pop_front() {
        if curr_depth >= depth {
            continue;
        }

        if let Some(neighbors) = adj.get(&curr) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor.clone());
                    queue.push_back((neighbor.clone(), curr_depth + 1));
                }
            }
        }
    }

    let local_nodes: Vec<GraphNode> = all
        .nodes
        .into_iter()
        .filter(|n| visited.contains(&n.id))
        .collect();

    let local_edges: Vec<GraphEdge> = all
        .edges
        .into_iter()
        .filter(|e| visited.contains(&e.source) && visited.contains(&e.target))
        .collect();

    Ok(WorkspaceGraphData {
        nodes: local_nodes,
        edges: local_edges,
    })
}
