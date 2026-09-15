const fs = require('fs');

const schemaPath = './prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

const replacements = {
  'model contacts {': 'model Contact {\n  @@map("contacts")',
  'model contact_identities {': 'model ContactIdentity {\n  @@map("contact_identities")',
  'model assignment_rules {': 'model AssignmentRule {\n  @@map("assignment_rules")',
  'model assignment_logs {': 'model AssignmentLog {\n  @@map("assignment_logs")',
  'model assignment_queues {': 'model AssignmentQueue {\n  @@map("assignment_queues")',
  'model attribution_touches {': 'model AttributionTouch {\n  @@map("attribution_touches")'
};

// Also rename relations
// e.g. `contacts    contacts[]` -> `contacts Contact[]`
const relationReplacements = [
  {from: / contacts /g, to: ' Contact '},
  {from: / contacts\?/g, to: ' Contact?'},
  {from: / contacts\[\]/g, to: ' Contact[]'},
  {from: / contact_identities /g, to: ' ContactIdentity '},
  {from: / contact_identities\?/g, to: ' ContactIdentity?'},
  {from: / contact_identities\[\]/g, to: ' ContactIdentity[]'},
  {from: / assignment_rules /g, to: ' AssignmentRule '},
  {from: / assignment_rules\?/g, to: ' AssignmentRule?'},
  {from: / assignment_rules\[\]/g, to: ' AssignmentRule[]'},
  {from: / assignment_logs /g, to: ' AssignmentLog '},
  {from: / assignment_logs\?/g, to: ' AssignmentLog?'},
  {from: / assignment_logs\[\]/g, to: ' AssignmentLog[]'},
  {from: / assignment_queues /g, to: ' AssignmentQueue '},
  {from: / assignment_queues\?/g, to: ' AssignmentQueue?'},
  {from: / assignment_queues\[\]/g, to: ' AssignmentQueue[]'},
  {from: / attribution_touches /g, to: ' AttributionTouch '},
  {from: / attribution_touches\?/g, to: ' AttributionTouch?'},
  {from: / attribution_touches\[\]/g, to: ' AttributionTouch[]'},
];

for (const [key, val] of Object.entries(replacements)) {
  schema = schema.replace(key, val);
}

for (const r of relationReplacements) {
  schema = schema.replace(r.from, r.to);
}

// Convert camelCase for fields in these models? Prisma introspection usually keeps snake_case if it was snake case in DB, but with `@map`.
// Since we lost the schema map, the fields are snake_case. Let's just leave them as snake case for now, or just let them be, we just need the models.
fs.writeFileSync(schemaPath, schema);
console.log("Schema recovered and renamed");
