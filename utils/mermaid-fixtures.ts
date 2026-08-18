export const fullDiagram = `flowchart TB
    subgraph External["External systems"]
        VSS_Kafka["VSS Kafka topics<br/>(devices, status, location, alarms, evidence)"]
        VSS_MySQL1["VSS MySQL Server 1"]
        VSS_MySQL2["VSS MySQL Server 2"]
        Traccar["Traccar GPS"]
        Telematics["Telematics API"]
        MDVR["MDVR / VSS NMS"]
        Keycloak["Keycloak"]
        Firebase["Firebase"]
        AWS["AWS S3"]
        InfluxDB["InfluxDB"]
    end

    subgraph Pipeline["kafka-to-postgres"]
        Consumers["Per-topic Kafka consumers"]
        MasterSync["Master sync (MySQL merge)"]
        Webhooks["Webhook dispatcher"]
        Health["Health / metrics server"]
    end

    subgraph Data["Data stores"]
        PG["PostgreSQL<br/>(platform_integrator)"]
        Redis["Redis cache"]
    end

    subgraph API["platform-integrator-server"]
        REST["REST API /api/v1"]
        WS["WebSockets /ws/location"]
        Crawler["MDVR crawler (optional)"]
    end

    subgraph Web["platform-integrator (Nuxt 3 SPA)"]
        UI["Dashboard, maps, evidence,<br/>alarms, reports, master data"]
        Nitro["Nitro server routes<br/>(session, Traccar proxy)"]
    end`;
