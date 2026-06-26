import React, { useEffect, useRef, useState } from 'react';
import NeoVis from 'neovis.js';
import axios from 'axios';
import './KnowledgeGraph.css';
import '../styles/shared.css';

const KnowledgeGraph = () => {
    const visRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const renderGraph = async () => {
            try {
                const response = await axios.get("http://localhost:5000/neo4j-config");
                const { url, user, password } = response.data;

                // Strip +s/+ssc schemes for NeoVis to prevent duplicate encryption configuration errors
                let neoVisUrl = url;
                if (neoVisUrl && typeof neoVisUrl === 'string') {
                    if (neoVisUrl.startsWith("neo4j+s://")) {
                        neoVisUrl = neoVisUrl.replace("neo4j+s://", "neo4j://");
                    } else if (neoVisUrl.startsWith("bolt+s://")) {
                        neoVisUrl = neoVisUrl.replace("bolt+s://", "bolt://");
                    }
                }

                const config = {
                    containerId: visRef.current.id,
                    neo4j: {
                        serverUrl: neoVisUrl,
                        serverUser: user,
                        serverPassword: password,
                        driverConfig: {
                            encrypted: true,
                            trust: "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES"
                        }
                    },
                    visConfig: {
                        nodes: {
                            font: {
                                color: '#ffffff', // White labels for dark backgrounds
                                size: 12
                            }
                        },
                        edges: {
                            font: {
                                color: '#cccccc', // Light gray labels for relationships
                                size: 10
                            },
                            color: {
                                color: '#555555', // visible dark gray lines
                                highlight: '#60a5fa', // glowing blue on hover
                                hover: '#60a5fa'
                            }
                        }
                    },
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
                        "Script": {
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
                            thickness: 1.5
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
                    initialCypher: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100"
                };
                const NeoVisImpl = NeoVis.default || NeoVis;
                const viz = new NeoVisImpl(config);
                viz.render();
                setLoading(false);
            } catch (err) {
                console.error("Failed to load Neo4j config:", err);
                setError(`Failed to connect to the knowledge graph database: ${err.message || err}`);
                setLoading(false);
            }
        };

        renderGraph();
    }, []);

    return (
        <div className="page-container">
            <div className="page-content">
                <div className="knowledge-graph-container">
                    <h2>Knowledge Graph Visualization</h2>
                    <div className="graph-viewport-wrapper">
                        {loading && (
                            <div className="graph-loading-overlay">
                                <div className="loader-spinner"></div>
                                <div className="loading-text">Connecting to Knowledge Graph...</div>
                            </div>
                        )}
                        {error && <div className="error-msg">{error}</div>}
                        <div id="viz" ref={visRef}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeGraph;