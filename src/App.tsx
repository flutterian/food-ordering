import React from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

export default function App() {
    const agent = useAgent({ agent: "FoodOrderingAgent" });

    const { messages, sendMessage, status, addToolOutput } = useAgentChat({
        agent,
        // 🌟 [핵심] 클라이언트 전용 도구가 실행될 때 호출되는 콜백 함수
        onToolCall: async ({ toolCall, addToolOutput }) => {
            console.log("🖥️ [프론트] 백엔드로부터 도구 호출 요청을 받음:", toolCall);

            // 도구 이름이 'getLocation'일 때 실제 브라우저 위치 정보를 가져옵니다
            if (toolCall.toolName === "getLocation") {
                try {
                    // 브라우저의 비동기 Geolocation API를 Promise로 래핑하여 호출합니다
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });

                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };

                    console.log("🖥️ [프론트] 사용자의 위치 좌표 수집 성공:", coords);

                    // 🌟 수집한 데이터를 addToolOutput을 사용하여 백엔드 에이전트(LLM)에 돌려줍니다 [5, 6, 9]
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: {
                            ...coords,
                            message: "위치 수집에 성공하였습니다."
                        }
                    });
                } catch (error) {
                    console.error("🖥️ [프론트] 위치 권한 에러:", error);

                    // 에러가 났을 때도 에이전트가 흐름을 이어갈 수 있도록 에러 피드백을 전달합니다 [10, 11]
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: { error: "사용자가 위치 수집 권한을 거부했거나 오류가 발생했습니다." }
                    });
                }
            }
        }
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("input") as HTMLInputElement;
        if (!input.value.trim()) return;

        sendMessage({ text: input.value });
        input.value = "";
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
            <h2 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px" }}>🍕 음식 주문 컨시어지 에이전트</h2>

            {/* 실시간 메시지 로그 */}
            <div style={{ height: "400px", overflowY: "auto", border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "15px", backgroundColor: "#f9f9f9" }}>
                {messages.map((msg) => (
                    <div key={msg.id} style={{ margin: "12px 0", textAlign: msg.role === "user" ? "right" : "left" }}>
                        <strong style={{ color: msg.role === "user" ? "#0070f3" : "#333" }}>
                            {msg.role === "user" ? "나" : "비서(Claw)"}:
                        </strong>
                        <div style={{ display: "inline-block", backgroundColor: msg.role === "user" ? "#e1f5fe" : "#fff", padding: "8px 12px", borderRadius: "12px", border: "1px solid #eee", marginTop: "4px" }}>
                            {msg.parts.map((part, i) =>
                                part.type === "text" ? <span key={i}>{part.text}</span> : null
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 메시지 입력 영역 */}
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px" }}>
                <input
                    name="input"
                    placeholder="타코 하나 담아주고, 배달해줘!"
                    style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                    disabled={status !== "ready"}
                />
                <button
                    type="submit"
                    disabled={status !== "ready"}
                    style={{ padding: "10px 20px", borderRadius: "4px", border: "none", backgroundColor: "#0070f3", color: "#fff", cursor: "pointer" }}
                >
                    {status === "streaming" ? "입력 중..." : "보내기"}
                </button>
            </form>
        </div>
    );
}