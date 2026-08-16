import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	NextFunction,
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { authRoutes } from "./app/modules/auth/auth.routes";
import helmet from "helmet";
import { requestLogger } from "./app/middleware/requestLogger";
import { apiRateLimiter } from "./app/middleware/rateLimiter";
import { planRoutes } from "./app/modules/plan/plan.routes";
import { userRoutes } from "./app/modules/user/user.routes";

const app: Application = express();

// using helmet middleware
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

app.use(requestLogger);

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));



// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// route middleware
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/plans", planRoutes);


// Global API rate limiter
app.use("/api", apiRateLimiter);


// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to HR ManageMent System",
	});
});

// using global Error
app.use(globalErrorHandler);
app.use(notFound);


export default app;