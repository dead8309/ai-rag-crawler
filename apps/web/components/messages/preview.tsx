"use client";

import type { ChatRequestOptions, Message } from "ai";
import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { BotIcon, SearchIcon } from "lucide-react";
import { PencilEditIcon } from "@/components/icons";
import { Markdown } from "@/components/md";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import equal from "fast-deep-equal";
import Link from "next/link";

const PurePreviewMessage = ({
  message,
  setMessages,
  reload,
}: {
  message: Message;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[])
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  return (
    <div className="w-full mx-auto max-w-3xl px-4 group/message">
      <div
        className={cn(
          "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
          {
            "w-full": mode === "edit",
            "group-data-[role=user]/message:w-fit": mode !== "edit",
          }
        )}
      >
        {message.role === "assistant" && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
            <div className="translate-y-px">
              <BotIcon size={14} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {message.content && mode === "view" && (
            <div className="flex flex-row gap-2 items-start">
              {message.role === "user" && (
                <Button
                  variant="ghost"
                  className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                  onClick={() => {
                    setMode("edit");
                  }}
                >
                  <PencilEditIcon />
                </Button>
              )}

              <div
                className={cn("flex flex-col gap-4", {
                  "bg-primary text-primary-foreground px-3 py-2 rounded-xl":
                    message.role === "user",
                })}
              >
                <Markdown>{message.content}</Markdown>
              </div>
            </div>
          )}

          {message.content && mode === "edit" && (
            <div className="flex flex-row gap-2 items-start">
              <div className="size-8" />

              {/* <MessageEditor */}
              {/*   key={message.id} */}
              {/*   message={message} */}
              {/*   setMode={setMode} */}
              {/*   setMessages={setMessages} */}
              {/*   reload={reload} */}
              {/* /> */}
            </div>
          )}

          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.toolInvocations.map((toolInvocation) => {
                const { toolName, toolCallId, state, args } = toolInvocation;

                if (state === "result") {
                  const { result } = toolInvocation;

                  const references: string = result.map((docs: any) =>
                    docs.url.endsWith("/") ? docs.url : docs.url + "/"
                  );
                  const uniqueReferences = [...new Set(references)];

                  return (
                    <div key={toolCallId}>
                      {toolName === "getInformation" ? (
                        <div
                          className="flex gap-2 items-start"
                          key={toolInvocation.toolCallId}
                        >
                          <div className="size-7 rounded-md border flex items-center justify-center">
                            <SearchIcon className="size-4" />
                          </div>
                          Found relevant information:
                          <div className="flex flex-col gap-2">
                            {/* {toolInvocation.toolName} */}
                            {uniqueReferences.map((r, idx) => (
                              <Badge key={idx} variant="secondary">
                                <Link href={r}>{r}</Link>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (
      !equal(
        prevProps.message.toolInvocations,
        nextProps.message.toolInvocations
      )
    )
      return false;

    return true;
  }
);
