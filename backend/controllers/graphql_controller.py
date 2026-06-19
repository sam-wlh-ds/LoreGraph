from flask import Blueprint, request, jsonify
from graphene import ObjectType, String, Schema, Field, List
from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

graphql_bp = Blueprint("graphql_bp", __name__)

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASS"))
)

class NodeType(ObjectType):
    label = String()
    name = String()

class RelationshipType(ObjectType):
    start_node = Field(NodeType)
    end_node = Field(NodeType)
    type = String()

class Query(ObjectType):
    all_relationships = List(RelationshipType)

    def resolve_all_relationships(root, info):
        with driver.session() as session:
            result = session.run("""
                MATCH (a)-[r]->(b)
                RETURN labels(a)[0] AS a_label, a.name AS a_name,
                       labels(b)[0] AS b_label, b.name AS b_name,
                       type(r) AS rel_type
                LIMIT 100
            """)
            return [
                RelationshipType(
                    start_node=NodeType(label=record["a_label"], name=record["a_name"]),
                    end_node=NodeType(label=record["b_label"], name=record["b_name"]),
                    type=record["rel_type"]
                ) for record in result
            ]

schema = Schema(query=Query)

@graphql_bp.route("/graphql", methods=["POST"])
def graphql_server():
    data = request.get_json()
    result = schema.execute(data.get("query"))
    return jsonify(result.data)
