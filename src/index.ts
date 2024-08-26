/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Resend } from "resend";
import { Redis } from "@upstash/redis/cloudflare";
export interface Env {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
	RESEND_API_KEY: string;
}

const emails: string[] = [
	"aegooby@gmail.com",
];

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event, env: Env, ctx): Promise<void> {
    const resend = new Resend(env.RESEND_API_KEY);
		const redis = Redis.fromEnv(env);
		const response = await fetch('https://slotted.co/graphql', {
			headers: {
				'content-type': 'application/json',
			},
			method: "POST",
			body: JSON.stringify({
				"query": "query { sheet(token:\"flowstatemic\") { events { date } title } }"
			}),
		});
		if (response.ok) {
			const body = await response.json();
			console.log("Received response from Slotted GraphQL API:", JSON.stringify(body, undefined, 2));
			const events = (body as any).data.sheet.events;
			if (events.length > 0) {
				const date = events[0].date;
				const lastDate = await redis.get<string>("date");
				if (date !== lastDate) {
					console.log("Found new event sheet with date:", date);
					const emailResult = await resend.emails.send({
						from: "slotted@zeeyadkay.com",
						to: emails,
						subject: "Flow State Mic List Available",
						html: '<p><a href="https://slotted.co/flowstatemic">Sign Up</a></p>'
					});
					if (emailResult.error) {
						console.error("Email error:", emailResult.error.message);
						throw new Error(emailResult.error.message);
					}
					console.log("Sent email with ID:", emailResult.data?.id);
					await redis.set("date", date);
				}
			}
		} else {
			console.error("Slotted GraphQL API error:", response.statusText);
			throw new Error(response.statusText);
		}
	},
} satisfies ExportedHandler<Env>;
