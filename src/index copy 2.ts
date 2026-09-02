import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, tool } from "ai";
import { z } from 'zod';

export class FoodOrderingAgent extends AIChatAgent {
	cart: string[] = [];

	// 백엔드 AI 모델 호출 및 스트리밍 처리
	async onChatMessage() {
		// 1. wrangler.jsonc에 바인딩된 AI 서비스를 연결합니다 [4].
		const workersai = createWorkersAI({ binding: this.env.AI });

		// 2. AI SDK의 streamText를 사용하여 실시간 응답을 생성합니다 [3, 4].
		const result = streamText({
			// 빠르고 가벼운 모델인 glm-4.7-flash 혹은 llama-3-8b-instruct를 권장합니다 [3, 5].
			model: workersai("@cf/zai-org/glm-4.7-flash"),
			system: "당신은 친절한 음식 주문 비서(Claw)입니다. 사용자가 피자, 타코, 비빔밥을 주문할 수 있도록 도와주세요. 아직 도구는 연결되지 않았으므로 친절한 대화 위주로 답변해 주세요.",
			// SQLite 데이터베이스에서 대화 기록을 가져와 LLM이 읽을 수 있는 형태로 변환합니다 [6, 7].
			messages: await convertToModelMessages(this.messages),
			// 🌟 도구를 호출하고 나서 결과를 바탕으로 다시 대답하려면 maxSteps가 2 이상이어야 합니다.
			// @ts-ignore
			// maxSteps: 3,

			// // 🌟 도구 딱 1개만 정의합니다.
			// tools: {
			// 	// 1. 기존 메뉴 확인 도구
			// 	getMenu: tool({
			// 		description: "주문 가능한 전체 음식 메뉴 목록을 가져옵니다.",
			// 		parameters: z.object({}),
			// 		execute: async () => {
			// 			console.log("🛠️ [서버 실행 로그] getMenu 실행됨");
			// 			return { menu: ["라지 페퍼로니 피자", "치즈 피자", "타코", "비빔밥", "애호박 전"] };
			// 		},
			// 	} as any),

			// 	// 👇 2. 새롭게 추가: 장바구니 담기 도구
			// 	addToCart: tool({
			// 		description: "사용자가 선택한 메뉴를 장바구니에 담습니다.",
			// 		parameters: z.object({
			// 			item: z.string().describe("장바구니에 담을 메뉴의 정확한 이름"),
			// 		}),
			// 		execute: async ({ item }: any) => {
			// 			this.cart.push(item); // 배열에 아이템 추가
			// 			console.log(`🛠️ [서버 실행 로그] addToCart 실행됨 (담은 메뉴: ${item})`);
			// 			console.log(`🛒 [현재 장바구니 상태]:`, this.cart);
			// 			return { success: true, message: `${item}이(가) 장바구니에 담겼습니다.` };
			// 		},
			// 	} as any),

			// 	// 👇 3. 새롭게 추가: 장바구니 확인 도구
			// 	viewCart: tool({
			// 		description: "현재 장바구니에 담긴 내역을 확인합니다.",
			// 		parameters: z.object({}),
			// 		execute: async () => {
			// 			console.log("🛠️ [서버 실행 로그] viewCart 실행됨");
			// 			return { cart: this.cart, totalItems: this.cart.length };
			// 		},
			// 	} as any)
			// }
		});

		// 3. 생성된 텍스트 스트림을 클라이언트가 인식할 수 있는 규격으로 자동 변환해 반환합니다 [3, 4, 8].
		return result.toUIMessageStreamResponse();
	}
}

export default {
	async fetch(request: Request, env: any) {
		// 들어오는 웹소켓/HTTP 요청을 에이전트로 중적 라우팅합니다 [9, 10].
		return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
	}
};