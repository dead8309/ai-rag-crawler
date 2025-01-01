import { redirect } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AiChat } from "@/components/chat";
import { client } from "@/lib/client";

async function fetchSiteDetails(siteId: number) {
  const response = await client.api.sites[":id"].$get({
    param: {
      id: siteId,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch site details");
  }
  return response.json();
}

// async function fetchWorkflowStatus(workflowId: string) {
//   const res = await client.api.scrape.workflow[":id"].$get({
//     param: {
//       id: workflowId,
//     },
//   });
//   if (!res.ok) {
//     throw new Error("Failed to fetch workflow status");
//   }
//   return res.json();
// }
//
export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: number }>;
}) {
  const siteId = (await params).siteId;
  if (siteId === null) {
    redirect("/404");
  }

  const siteDetails = await fetchSiteDetails(siteId);

  // const { data: workflowStatus, isLoading: isWorkflowLoading } =
  //   useQuery<WorkflowStatus>({
  //     queryKey: ["workflowStatus", siteId],
  //     queryFn: () => fetchWorkflowStatus("mock-workflow-id"),
  //     refetchInterval: 2000,
  //     enabled: !!siteId,
  //     staleTime: 0,
  //   });

  // const isLoading =
  //   isSiteLoading || isWorkflowLoading || workflowStatus?.status !== "complete";

  if (!siteId) return <div className="text-center">Invalid Site ID</div>;

  return (
    <div className="flex flex-col min-w-0 h-dvh mx-4">
      <Breadcrumb className="mt-2">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Sites</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{siteDetails?.siteUrl}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* <Link */}
      {/*   href={siteDetails?.url || ""} */}
      {/*   className="flex gap-2 items-center text-primary" */}
      {/* > */}
      {/*   {siteDetails?.siteUrl} */}
      {/*   <LinkIcon className="size-4" /> */}
      {/* </Link> */}

      {/* <div className="mb-4 hidden lg:block"> */}
      {/*   <h2 className="text-xl font-bold mb-2">Pages:</h2> */}
      {/*   <ul className="flex flex-wrap gap-2"> */}
      {/*     {siteDetails?.pages.map((page) => ( */}
      {/*       <li */}
      {/*         key={page.id} */}
      {/*         className="group bg-background border p-2 w-fit hover:bg-muted" */}
      {/*       > */}
      {/*         <a */}
      {/*           href={page.url} */}
      {/*           target="_blank" */}
      {/*           rel="noopener noreferrer" */}
      {/*           className="text-sm text-foreground group-hover:text-muted-foreground group-hover:underline" */}
      {/*         > */}
      {/*           {page.title} */}
      {/*         </a> */}
      {/*       </li> */}
      {/*     ))} */}
      {/*   </ul> */}
      {/* </div> */}

      <AiChat siteId={siteId} />
      {/* <ChatInterface siteId={siteId} /> */}
    </div>
  );
}
