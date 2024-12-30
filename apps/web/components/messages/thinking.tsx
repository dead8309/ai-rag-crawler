import { Loader2 } from "lucide-react";
import { BotIcon } from "../icons";

export const ThinkingMessage = () => {
  return (
    <div className="w-full mx-auto max-w-3xl px-4 group/message ">
      <div className={"flex gap-4"}>
        <div className="size-8 flex items-center rounded-full justify-center relative">
          <Loader2 className="size-10 absolute animate-spin stroke-1 text-muted-foreground" />
          <BotIcon />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </div>
  );
};
