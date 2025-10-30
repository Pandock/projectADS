curl -X POST "$BASE/v1/graphql" -H "x-hasura-admin-secret: <ADMIN_SECRET>" -H "Content-Type: application/json" -d "{\"query\":\"mutation InsertUsers(\$objs: [users_insert_input!]!){ insert_users(objects:\$objs){ affected_rows returning{ id name created_at }}}\",\"variables\":{\"objs\":[{\"name\":\"Alice\"},{\"name\":\"Bob\"}]}}"


query { users(order_by: {id: asc}) { id name created_at } }

  
