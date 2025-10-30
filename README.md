curl -X POST "$BASE/v1/graphql" -H "x-hasura-admin-secret: <ADMIN_SECRET>" -H "Content-Type: application/json" -d "{\"query\":\"mutation InsertUsers(\$objs: [users_insert_input!]!){ insert_users(objects:\$objs){ affected_rows returning{ id name created_at }}}\",\"variables\":{\"objs\":[{\"name\":\"Alice\"},{\"name\":\"Bob\"}]}}"


query { users(order_by: {id: asc}) { id name created_at } }

  
{
"query": "mutation InsertTestTable3($objs: [test_schema1_test_table3_insert_input!]!) { insert_test_schema1_test_table3(objects: $objs) { affected_rows returning { t1_id t1_col1 t1_col2 uid } } }",
"variables": {
"objs": [
{ "t1_id": 1, "t1_col1": "A", "t1_col2": "B", "uid": "u-001" },
{ "t1_id": 2, "t1_col1": "C", "t1_col2": "D", "uid": "u-002" }
]
}
}
