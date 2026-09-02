import React from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

export default function App() {
    // 1. 백엔드의 FoodOrderingAgent Durable Object 인스턴스에 연결합니다 [12, 13].
    const agent = useAgent({ agent: "FoodOrderingAgent" });

    // 2. 실시간 채팅에 필요한 메시지 리스트, 전송 함수, 상태 등을 훅으로 간편하게 가져옵니다 [12, 13].
    const { messages, sendMessage, status, error } = useAgentChat({ agent });
    console.log({ messages, status, error })

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("input") as HTMLInputElement;
        if (!input.value.trim()) return;

        // 에이전트로 사용자의 입력을 전송합니다 [12].
        sendMessage({ text: input.value });
        input.value = "";
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
            <h2 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px" }}>🍕 음식 주문 컨시어지 에이전트</h2>

            {/* 실시간 메시지 로그 */}
            <div style={{ height: "400px", overflowY: "auto", border: "1px solid #ddd", borderRadius: "8px", padding: "15px", marginBottom: "15px", backgroundColor: "#f9f9f9" }}>
                {messages.map((msg: any) => (
                    <div key={msg.id} style={{ margin: "12px 0", textAlign: msg.role === "user" ? "right" : "left" }}>
                        <strong style={{ color: msg.role === "user" ? "#0070f3" : "#333" }}>
                            {msg.role === "user" ? "나" : "비서(Claw)"}:
                        </strong>
                        <div style={{ display: "inline-block", backgroundColor: msg.role === "user" ? "#e1f5fe" : "#fff", padding: "8px 12px", borderRadius: "12px", border: "1px solid #eee", marginTop: "4px" }}>
                            {/* 메시지 파트 중 텍스트 타입만 렌더링합니다 [12] */}
                            {msg.parts.map((part: any, i: any) =>
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
                    placeholder="메뉴를 물어보세요! (예: 안녕? 피자 주문하고 싶어)"
                    style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                    disabled={status !== "ready"} // 전송 중이거나 스트리밍 중일 때는 임시로 입력을 막습니다 [12].
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