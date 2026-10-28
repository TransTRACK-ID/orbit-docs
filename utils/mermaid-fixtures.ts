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

export const reportedAndChainDiagram = `flowchart TB
    subgraph users [Users and integrators]
        WEB[Web browsers]
        MOB[Mobile / driver apps]
        WB[Weight bridge and TMS]
        TEL[Telematics provider]
    end

subgraph fe [logistic-service-integrator-frontend]
        NUXT[Nuxt 2 SPA port 3000]
        VUEX[Vuex store modules]
        AUTH_FE["@nuxtjs/auth-next Bearer token"]
    end

subgraph edge [Edge]
        TRAEFIK[Traefik reverse proxy]
    end

subgraph be [logistic-service-integrator-server]
        FRANKEN[FrankenPHP Laravel HTTP]
        API["/api/v1 v2 v3"]
        MW[Middleware Sanctum roles apikey]
        SVC[Domain Services]
        MODELS[Eloquent Entity and Table models]
    end

subgraph async [Background]
        JOBS[Supervisor container]
        HORIZON[Laravel Horizon]
        CRON[schedule:work]
    end

subgraph data [Data and files]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        S3[(AWS S3)]
    end

subgraph ext [External services]
        MAP[Mapbox directions]
        FMS[FMS and Traccar]
        NOTIFY[FCM and WhatsApp]
        OTHER[reCAPTCHA Sentry TMS mirror]
    end

WEB --> TRAEFIK --> NUXT
    NUXT --> VUEX
    NUXT --> AUTH_FE
    AUTH_FE -->|HTTPS BACKEND_URL| TRAEFIK
    TRAEFIK --> FRANKEN --> API --> MW --> SVC --> MODELS --> PG
    MOB --> TRAEFIK
    WB --> TRAEFIK
    TEL -->|POST webhook/telematic| TRAEFIK
    SVC --> REDIS
    JOBS --> HORIZON --> REDIS
    JOBS --> CRON
    SVC --> S3
    SVC --> MAP and FMS and NOTIFY and OTHER`;
