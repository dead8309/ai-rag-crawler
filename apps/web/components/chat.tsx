"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "ai/react";
import { ThinkingMessage } from "@/components/messages/thinking";
import { PreviewMessage } from "./messages/preview";

import { useScrollToBottom } from "./use-scroll-to-bottom";
import { client } from "@/lib/client";

export function AiChat({ siteId }: { siteId: number }) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    reload,
  } = useChat({
    api: client.api.sites.ask.stream.$url().toString(),
    body: { siteId: Number(siteId) },
  });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <>
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-auto pt-4"
      >
        {messages.map((message) => (
          <PreviewMessage
            key={message.id}
            message={message}
            // isLoading={isLoading}
            setMessages={setMessages}
            reload={reload}
          />
        ))}
        {/*   // <div */}
        {/*   //   key={index} */}
        {/*   //   className={cn("w-full flex justify-start items-start gap-2", { */}
        {/*   //     "justify-end": message.role === "user", */}
        {/*   //   })} */}
        {/*   // > */}
        {/*   //   <div */}
        {/*   //     className={cn("border p-2 font-mono max-w-[80%]", { */}
        {/*   //       "bg-muted": message.role === "assistant", */}
        {/*   //     })} */}
        {/*   //   > */}
        {/*   //     <MD>{message.content}</MD> */}
        {/*   //   </div> */}
        {/*   // </div> */}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

        {/* <div className="flex gap-2 items-start"> */}
        {/*   <div className="size-7 rounded-md border flex items-center justify-center"> */}
        {/*     <BotIcon className="size-4 animate-pulse" /> */}
        {/*   </div> */}
        {/*   <div className="prose animate-pulse">Thinking...</div> */}
        {/* </div> */}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex mx-auto px-4 pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
      >
        <Input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          className="flex-grow bg-secondary border-0 border-b border-border rounded-3xl text-primary"
        />
        <Button type="submit">Send</Button>
      </form>
    </>
  );
}
