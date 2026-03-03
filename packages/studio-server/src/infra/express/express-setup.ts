import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

export function createExpressApp() {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: false,
            hsts: process.env.ENABLE_HSTS === 'true' ? undefined : false,
        })
    );

    const corsOptions: cors.CorsOptions = {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
        preflightContinue: false,
        optionsSuccessStatus: 200,
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    return app;
}
