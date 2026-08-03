import "dotenv/config";
import { Telegraf } from "telegraf";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const bot = new Telegraf(process.env.BOT_TOKEN);

export const ADMIN_ID = process.env.ADMIN_ID;

export const CHANNEL_ID = process.env.CHANNEL_ID;