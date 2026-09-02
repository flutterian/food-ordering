import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, tool, isLoopFinished } from "ai";
import { z } from 'zod';

export class FoodOrderingAgent extends AIChatAgent {

	// 🌟 [과제 요구사항] 대화가 SQLite DB에 영구 저장되기 전에 카드 번호를 마스킹 처리합니다 [1, 5].
	protected override sanitizeMessageForPersistence(message: any) {
		return {
			...message,
			parts: message.parts.map((part: any) => {
				if (part.type === "text") {
					// 13~16자리의 신용카드 번호 형태의 숫자 패턴을 [REDACTED]로 치환합니다 [2].
					const maskedText = part.text.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED]");
					return { ...part, text: maskedText };
				}
				return part;
			}),
		};
	}

	async onChatMessage() {
		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai("@cf/zai-org/glm-4.7-flash"),
			system: `당신은 친절한 음식 주문 비서 "Claw"입니다. 사용자가 피자, 타코, 비빔밥을 주문할 수 있도록 도와주세요.
다음과 같은 단계로 작업을 정밀하게 조율해야 합니다:
1. 사용자가 메뉴를 물어보면 'getMenu'를 호출해 보여줍니다.
2. 주문하고 싶은 음식을 말하면 'addToCart'를 사용해 장바구니에 차곡차곡 누적합니다.
3. 배달 위치를 지정하기 위해 'getLocation'을 호출하여 사용자의 브라우저 GPS 정보를 수집합니다.
4. 장바구니 목록과 최종 배달 정보가 모두 정리되면 'viewCart'를 실행하여 총액을 파악하고, 마지막으로 결제 승인을 얻기 위해 'placeOrder' 도구를 최종 실행하세요.`,
			messages: await convertToModelMessages(this.messages),
			// @ts-ignore
			maxSteps: 5,
			stopWhen: isLoopFinished(), // 🌟 도구 루프가 완전히 끝날 때까지 회전 [6, 7]

			tools: {
				// 1. 기존 메뉴 확인 도구
				getMenu: tool({
					description: "주문 가능한 전체 음식 메뉴 목록과 가격 정보를 가져옵니다.",
					inputSchema: z.object({}),
					execute: async () => {
						console.log("🛠️ [서버] getMenu 실행됨");
						return { menu: ["라지 페퍼로니 피자 (18,000원)", "치즈 피자 (15,000원)", "타코 (12,000원)", "비빔밥 (10,000원)", "애호박 전 (4,000원)"] };
					},
				}),

				// 2. 장바구니 담기 도구
				addToCart: tool({
					description: "사용자가 선택한 메뉴를 장바구니에 담습니다.",
					inputSchema: z.object({
						item: z.string().describe("장바구니에 담을 구체적인 메뉴 이름"),
					}),
					execute: async ({ item }) => {
						const cart = (await this.ctx.storage.get<string[]>("cart")) || [];
						cart.push(item);
						await this.ctx.storage.put("cart", cart);

						console.log(`🛠️ [서버] addToCart 실행: ${item}`);
						return { success: true, message: `${item}이(가) 장바구니에 정상적으로 추가되었습니다.` };
					},
				}),

				// 3. 장바구니 확인 도구
				viewCart: tool({
					description: "현재 장바구니에 임시 보관 중인 내역을 가져옵니다.",
					inputSchema: z.object({}),
					execute: async () => {
						const cart = (await this.ctx.storage.get<string[]>("cart")) || [];
						console.log("🛠️ [서버] viewCart 실행됨:", cart);
						return { cart, totalItems: cart.length };
					},
				}),

				// 4. 기존 브라우저 GPS 도구 (클라이언트)
				getLocation: tool({
					description: "사용자의 브라우저 GPS 센서를 활용해 현재 실시간 위치(위도, 경도)를 수집합니다.",
					inputSchema: z.object({}),
				}),

				// 🌟 5. [새롭게 추가] 주문 결제 도구 (Human-in-the-loop 승인 대기형)
				placeOrder: tool({
					description: "장바구니 최종 확정 및 결제 처리를 수행하고 주문을 완전히 접수합니다.",
					inputSchema: z.object({}),
					// needsApproval이 true를 반환하면 승인 과정을 거치기 전에는 execute를 절대 실행하지 않습니다 [3].
					needsApproval: async () => true,
					execute: async () => {
						// 주문 완료 시 SQLite/DO Storage의 장바구니를 완전히 초기화해 줍니다.
						await this.ctx.storage.delete("cart");
						console.log("💳 [서버] 최종 주문 결제 성공 및 카트 비우기 완료");
						return { success: true, message: "주문이 완전히 접수되었습니다! 맛있는 음식을 곧 보내드릴게요! 🍕" };
					}
				})
			}
		});

		return result.toUIMessageStreamResponse();
	}
}

export default {
	async fetch(request: Request, env: any) {
		return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
	}
};