import React from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
// 🌟 AI SDK 및 Cloudflare 전용 승인 컴포넌트 헬퍼들을 가져옵니다.
import { getToolName, isToolUIPart } from "ai";
import { getToolApproval, getToolCallId, getToolPartState } from "@cloudflare/ai-chat/react";

export default function App() {
    const agent = useAgent({ agent: "FoodOrderingAgent" });

    const {
        messages,
        sendMessage,
        status,
        addToolOutput,
        addToolApprovalResponse // 🌟 최종 결제 승인 신호를 백엔드로 전달하는 함수 [3]
    } = useAgentChat({
        agent,
        onToolCall: async ({ toolCall, addToolOutput }) => {
            if (toolCall.toolName === "getLocation") {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: { ...coords, message: "위치 수집에 성공하였습니다." }
                    });
                } catch (error) {
                    addToolOutput({
                        toolCallId: toolCall.toolCallId,
                        output: { error: "위치 수집 거부 혹은 획득 실패" }
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

                        {/* 🌟 [승인 UI 구현] 승인 대기 중인(waiting-approval) 도구 파트가 있다면 승인용 단추 인터페이스를 그립니다 [3]. */}
                        {msg.parts
                            .filter((part) => isToolUIPart(part) && getToolPartState(part) === "waiting-approval")
                            .map((part) => {
                                const approval = getToolApproval(part);
                                if (!approval) return null;
                                return (
                                    <div key={getToolCallId(part)} style={{ marginTop: "10px", padding: "12px", border: "1px solid #ff9800", borderRadius: "8px", backgroundColor: "#fff3e0", textAlign: "left" }}>
                                        <p style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "bold", color: "#e65100" }}>
                                            💳 최종 주문 승인 요청 ({getToolName(part as any)})
                                        </p>
                                        <p style={{ fontSize: "13px", margin: "0 0 10px 0" }}>주문 총액과 내역을 확인하셨으면 승인해 주세요.</p>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={() => addToolApprovalResponse({ id: approval.id, approved: true })} // 승인 전달
                                                style={{ padding: "6px 12px", backgroundColor: "#4caf50", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                                            >
                                                결제 승인 (Approve)
                                            </button>
                                            <button
                                                onClick={() => addToolApprovalResponse({ id: approval.id, approved: false })} // 거절 전달
                                                style={{ padding: "6px 12px", backgroundColor: "#f44336", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                                            >
                                                거절 (Reject)
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ))}
            </div>

            {/* 메시지 입력 영역 */}
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px" }}>
                <input
                    name="input"
                    placeholder="페퍼로니 피자 하나 주문할게요."
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