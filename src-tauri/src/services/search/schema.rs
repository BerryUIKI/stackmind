use tantivy::schema::*;

#[derive(Clone)]
pub struct SearchSchema {
    pub schema: Schema,
    pub path: Field,
    pub file_name: Field,
    pub title: Field,
    pub body: Field,
    pub block_id: Field,
    pub block_type: Field,
    pub tags: Field,
    pub mtime_ms: Field,
    pub is_block: Field,
}

impl Default for SearchSchema {
    fn default() -> Self {
        Self::new()
    }
}

impl SearchSchema {
    pub fn new() -> Self {
        let mut builder = Schema::builder();

        let string_stored = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("raw")
                    .set_index_option(IndexRecordOption::Basic),
            )
            .set_stored();

        let text_field_indexing = TextFieldIndexing::default()
            .set_tokenizer("default")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options = TextOptions::default()
            .set_indexing_options(text_field_indexing)
            .set_stored();

        let path = builder.add_text_field("path", string_stored.clone());
        let file_name = builder.add_text_field("file_name", text_options.clone());
        let title = builder.add_text_field("title", text_options.clone());
        let body = builder.add_text_field("body", text_options.clone());
        let block_id = builder.add_text_field("block_id", string_stored.clone());
        let block_type = builder.add_text_field("block_type", string_stored);
        let tags = builder.add_text_field("tags", text_options);
        let mtime_ms = builder.add_i64_field("mtime_ms", FAST | STORED);
        let is_block = builder.add_i64_field("is_block", FAST | STORED);

        let schema = builder.build();

        Self {
            schema,
            path,
            file_name,
            title,
            body,
            block_id,
            block_type,
            tags,
            mtime_ms,
            is_block,
        }
    }
}
