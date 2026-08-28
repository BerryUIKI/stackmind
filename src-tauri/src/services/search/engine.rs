use crate::models::markdown::ParsedBlock;
use crate::models::search::SearchResult;
use crate::services::fs_service::{self, read_directory_tree};
use crate::services::markdown::block_parser;
use crate::services::search::schema::SearchSchema;
use std::fs;
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, Term, doc};

pub fn open_or_create_index(index_dir: &Path) -> Result<Index, String> {
    fs::create_dir_all(index_dir)
        .map_err(|e| format!("Failed to create search index directory: {e}"))?;

    let schema_def = SearchSchema::new();

    if let Ok(index) = Index::open_in_dir(index_dir) {
        Ok(index)
    } else {
        Index::create_in_dir(index_dir, schema_def.schema)
            .map_err(|e| format!("Failed to initialize Tantivy index: {e}"))
    }
}

pub struct DocumentToIndex<'a> {
    pub relative_path: &'a str,
    pub title: &'a str,
    pub content: &'a str,
    pub blocks: &'a [ParsedBlock],
    pub tags: &'a [String],
    pub mtime_ms: u64,
}

pub fn index_document(
    index: &Index,
    schema_def: &SearchSchema,
    doc: DocumentToIndex,
) -> Result<(), String> {
    let mut index_writer: IndexWriter = index
        .writer(50_000_000)
        .map_err(|e| format!("Failed to acquire index writer: {e}"))?;

    // Delete existing documents for this path
    let term = Term::from_field_text(schema_def.path, doc.relative_path);
    index_writer.delete_term(term);

    let file_name = Path::new(doc.relative_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(doc.relative_path)
        .trim_end_matches(".md");

    let tags_str = doc.tags.join(" ");

    // 1. Index document-level record (is_block = 0)
    index_writer
        .add_document(doc!(
            schema_def.path => doc.relative_path,
            schema_def.file_name => file_name,
            schema_def.title => doc.title,
            schema_def.body => doc.content,
            schema_def.block_id => "",
            schema_def.block_type => "document",
            schema_def.tags => tags_str.as_str(),
            schema_def.mtime_ms => doc.mtime_ms as i64,
            schema_def.is_block => 0i64,
        ))
        .map_err(|e| format!("Failed to index document: {e}"))?;

    // 2. Index block-level records (is_block = 1)
    for b in doc.blocks {
        index_writer
            .add_document(doc!(
                schema_def.path => doc.relative_path,
                schema_def.file_name => file_name,
                schema_def.title => doc.title,
                schema_def.body => b.content.as_str(),
                schema_def.block_id => b.block_id.as_str(),
                schema_def.block_type => b.block_type.as_str(),
                schema_def.tags => tags_str.as_str(),
                schema_def.mtime_ms => doc.mtime_ms as i64,
                schema_def.is_block => 1i64,
            ))
            .map_err(|e| format!("Failed to index block: {e}"))?;
    }

    index_writer
        .commit()
        .map_err(|e| format!("Failed to commit index changes: {e}"))?;

    Ok(())
}

pub fn search(
    index: &Index,
    schema_def: &SearchSchema,
    query_str: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    let reader: IndexReader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommitWithDelay)
        .try_into()
        .map_err(|e| format!("Failed to acquire index reader: {e}"))?;

    let searcher = reader.searcher();

    // Query parser spanning title, file_name, body, tags
    let mut query_parser = QueryParser::for_index(
        index,
        vec![
            schema_def.title,
            schema_def.file_name,
            schema_def.body,
            schema_def.tags,
        ],
    );

    // Boost title and file_name higher than body
    query_parser.set_field_boost(schema_def.title, 3.0);
    query_parser.set_field_boost(schema_def.file_name, 2.5);
    query_parser.set_field_boost(schema_def.tags, 2.0);
    query_parser.set_field_boost(schema_def.body, 1.0);

    let query = query_parser
        .parse_query(query_str)
        .map_err(|e| format!("Invalid search query: {e}"))?;

    let top_docs = searcher
        .search(&query, &TopDocs::with_limit(limit))
        .map_err(|e| format!("Search execution failed: {e}"))?;

    let mut results = Vec::new();
    for (score, doc_address) in top_docs {
        let retrieved_doc: TantivyDocument = searcher
            .doc(doc_address)
            .map_err(|e| format!("Failed to retrieve doc: {e}"))?;

        let path = retrieved_doc
            .get_first(schema_def.path)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let file_name = retrieved_doc
            .get_first(schema_def.file_name)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let title = retrieved_doc
            .get_first(schema_def.title)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let body = retrieved_doc
            .get_first(schema_def.body)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let block_id = retrieved_doc
            .get_first(schema_def.block_id)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let block_type = retrieved_doc
            .get_first(schema_def.block_type)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let tags_raw = retrieved_doc
            .get_first(schema_def.tags)
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let tags: Vec<String> = tags_raw.split_whitespace().map(|s| s.to_string()).collect();

        let is_block_val = retrieved_doc
            .get_first(schema_def.is_block)
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let snippet = create_snippet(&body, query_str);

        results.push(SearchResult {
            path,
            file_name,
            title,
            block_id,
            block_type,
            snippet,
            score,
            tags,
            is_block: is_block_val == 1,
        });
    }

    Ok(results)
}

fn create_snippet(body: &str, query: &str) -> String {
    let lower_body = body.to_lowercase();
    let lower_q = query.to_lowercase();

    if let Some(pos) = lower_body.find(&lower_q) {
        let start = pos.saturating_sub(40);
        let end = (pos + lower_q.len() + 60).min(body.len());
        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }
        snippet.push_str(body[start..end].replace('\n', " ").trim());
        if end < body.len() {
            snippet.push_str("...");
        }
        snippet
    } else {
        let single = body.replace('\n', " ").trim().to_string();
        if single.len() <= 100 {
            single
        } else {
            format!("{}...", &single[..97])
        }
    }
}

pub fn rebuild_search_index(workspace_root: &Path) -> Result<(), String> {
    let search_dir = workspace_root.join(".stackmynd").join("search_index");
    if search_dir.exists() {
        let _ = fs::remove_dir_all(&search_dir);
    }
    fs::create_dir_all(&search_dir)
        .map_err(|e| format!("Failed to recreate search index directory: {e}"))?;

    let index = open_or_create_index(&search_dir)?;
    let schema_def = SearchSchema::new();

    let nodes = read_directory_tree(workspace_root, "")?;
    let mut md_files = Vec::new();
    collect_md_paths(&nodes, &mut md_files);

    for rel_path in md_files {
        if let Ok(payload) = fs_service::read_file(workspace_root, &rel_path) {
            let doc = block_parser::parse_markdown_document(&payload.content);
            let title = Path::new(&rel_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&rel_path)
                .trim_end_matches(".md");

            let _ = index_document(
                &index,
                &schema_def,
                DocumentToIndex {
                    relative_path: &rel_path,
                    title,
                    content: &payload.content,
                    blocks: &doc.blocks,
                    tags: &doc.tags,
                    mtime_ms: payload.mtime_ms,
                },
            );
        }
    }

    Ok(())
}

fn collect_md_paths(nodes: &[crate::models::fs::FileNode], out: &mut Vec<String>) {
    for n in nodes {
        if n.is_dir {
            if let Some(ref children) = n.children {
                collect_md_paths(children, out);
            }
        } else if n.name.ends_with(".md") || n.name.ends_with(".markdown") {
            out.push(n.relative_path.clone());
        }
    }
}
