import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, tool, isLoopFinished } from "ai";
import { z } from 'zod';

export class FoodOrderingAgent extends AIChatAgent {
	// 🌟 Durable Object의 Storage를 사용하여 세션이 끊기거나 재시작되어도 카트가 유지되도록 변경합니다 [6, 7].

	// 백엔드 AI 모델 호출 및 스트리밍 처리
	async onChatMessage() {
		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai("@cf/zai-org/glm-4.7-flash"),
			// 🌟 LLM이 도구 사용 후 답변을 제대로 마무리할 수 있도록 구체적인 지침을 줍니다.
			system: `당신은 친절한 음식 주문 비서 "Claw"입니다. 사용자가 피자, 타코, 비빔밥을 주문할 수 있도록 도와주세요.
사용자가 메뉴를 보여달라고 하면 'getMenu'를 호출하고, 장바구니에 담아달라고 하면 'addToCart'를, 장바구니를 보고 싶어 하면 'viewCart' 도구를 실행하세요.
도구 실행 결과(예: 장바구니 내역)를 획득하면, 그 결과 데이터(음식명, 수량 등)를 사용자에게 친절하게 요약하여 실시간 말로 풀어서 대답을 마무리 지으세요.`,
			messages: await convertToModelMessages(this.messages),

			// 🌟 도구 결과 처리 후 다음 답변 단계까지 매끄럽게 이어서 실행하도록 지정합니다 [3, 4].
			stopWhen: isLoopFinished(),

			// @ts-ignore
			maxSteps: 5,

			tools: {
				// 1. 기존 메뉴 확인 도구
				getMenu: tool({
					description: "주문 가능한 전체 음식 메뉴 목록과 가격 정보를 가져옵니다.",
					inputSchema: z.object({}), // 🌟 parameters -> inputSchema로 변경하여 프레임워크가 인식하도록 교정 [1]
					execute: async () => {
						console.log("🛠️ [서버 실행 로그] getMenu 실행됨");
						return { menu: ["라지 페퍼로니 피자 (18,000원)", "치즈 피자 (15,000원)", "타코 (12,000원)", "비빔밥 (10,000원)", "애호박 전 (4,000원)"] };
					},
				}),

				// 2. 장바구니 담기 도구
				addToCart: tool({
					description: "사용자가 선택한 메뉴를 장바구니에 담습니다.",
					inputSchema: z.object({
						// 🌟 .optional()을 빼서 LLM이 사용자의 질문으로부터 확실히 메뉴 단어를 추출하게 만듭니다.
						item: z.string().describe("장바구니에 담을 구체적인 메뉴 이름"),
					}), // 🌟 inputSchema 설정으로 as any 우회 제거 성공 [1]
					execute: async ({ item }) => {
						// SQLite DO Storage에서 카트 로드 [1, 7]
						const cart = (await this.ctx.storage.get<string[]>("cart")) || [];
						cart.push(item);
						// 안전하게 영구 업데이트 [1, 7]
						await this.ctx.storage.put("cart", cart);

						console.log(`🛠️ [서버] addToCart 실행 (담은 메뉴: ${item})`);
						console.log(`🛒 [현재 장바구니]:`, cart);
						return { success: true, message: `${item}이(가) 장바구니에 정상적으로 추가되었습니다.` };
					},
				}),

				// 3. 장바구니 확인 도구
				viewCart: tool({
					description: "현재 장바구니에 임시 보관 중인 내역을 가져옵니다.",
					inputSchema: z.object({}), // 🌟 parameters -> inputSchema로 변경 [1]
					execute: async () => {
						const cart = (await this.ctx.storage.get<string[]>("cart")) || [];
						console.log("🛠️ [서버 실행 로그] viewCart 실행됨:", cart);
						return { cart, totalItems: cart.length };
					},
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