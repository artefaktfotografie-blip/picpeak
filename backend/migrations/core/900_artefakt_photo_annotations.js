// artefakt fork: pen annotations guests draw on a photo in the lightbox.
// Numbered 900 so upstream's own migrations never collide with it.
// One row per guest and photo; `strokes` holds the drawing as JSON with
// coordinates normalised to the photo (0..1), so it scales to any rendition.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('photo_annotations'))) {
    await knex.schema.createTable('photo_annotations', (table) => {
      table.increments('id').primary();
      table.integer('photo_id').references('id').inTable('photos').onDelete('CASCADE');
      table.integer('event_id').references('id').inTable('events').onDelete('CASCADE');
      table.string('guest_identifier', 64).notNullable();
      table.integer('guest_id');
      table.string('guest_name', 100);
      table.string('guest_email', 255);
      table.text('strokes').notNullable();
      table.text('note');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['photo_id', 'guest_identifier']);
      table.index(['event_id']);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('photo_annotations');
};
