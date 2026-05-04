import { z } from "zod";

export const jsonObjectSchema = z.record(z.unknown());

export const AgentExecutionModeApiSchema = z.enum(["request", "hitl", "sub_agent"]);
export const AgentVersionStatusApiSchema = z.enum(["testing", "deployed"]);
export const SubAgentExecutionModelApiSchema = z.enum(["sequential", "parallel"]);
export const ServiceTypeApiSchema = z.enum(["http", "built_in"]);
