import React from 'react';
import { useEffect, useRef } from 'react';
import NeoVis from 'neovis.js';
import './KnowledgeGraph.css';
import '../styles/shared.css';

const KnowledgeGraph = () => {
    const visRef = useRef(null);

    useEffect(() => {
        const config = {
            container_id: visRef.current.id,
            server_url: "neo4j+s://46659ffb.databases.neo4j.io",
            server_user: "neo4j",
            server_password: "izPmjaBwAu6rVc6eLz2IFt25kyzEmoBjkaPeZ8BNvIs",
            labels: {
                "Character": {
                    caption: "name",
                    size: 2.0,
                    community: "community"
                },
                "Event": {
                    caption: "description",
                    size: 1.5
                },
                "Location": {
                    caption: "name",
                    size: 1.8
                },
                "Movie": {
                    caption: "title",
                    size: 2.2
                },
                "Universe": {
                    caption: "name",
                    size: 2.0
                },
                "Year": {
                    caption: "value",
                    size: 1.3
                }
            },
            relationships: {
                "IN_UNIVERSE": {
                    caption: false,
                    thickness: "confidence"
                },
                "INVOLVES": {
                    caption: false,
                    thickness: 1.5
                },
                "MENTIONED_IN": {
                    caption: false,
                    thickness: 1.2
                },
                "OCCURS_IN": {
                    caption: false,
                    thickness: 1.3
                },
                "SET_IN": {
                    caption: false,
                    thickness: 1.4
                }
            },
            arrows: true,
            initial_cypher: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100"
        };

        const viz = new NeoVis(config);
        viz.render();

        return () => {
            // Cleanup if needed
        };
    }, []);

    return (
        <div className="page-container">
            <div className="page-content">
                <div className="knowledge-graph-container">
                    <h2>Knowledge Graph Visualization</h2>
                    <div id="viz" ref={visRef}></div>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeGraph;