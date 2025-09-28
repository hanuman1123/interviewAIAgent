import React from "react";

export default function MessageBubble({ message }) {
  const isBot = message.sender === "bot";
  
  return (
    <div className={`chat ${isBot ? "chat-start" : "chat-end"} mb-4`}>
      <div className={`chat-bubble ${
        isBot ? "chat-bubble-primary" : "chat-bubble-secondary"
      }`}>
        {message.text}
      </div>
    </div>
  );
}
