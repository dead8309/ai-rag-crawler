import Link from "next/link";
import { Site } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusIcon } from "lucide-react";

async function fetchSites(): Promise<Site[]> {
  const response = await fetch("http://localhost:8787/api/sites");
  if (!response.ok) {
    throw new Error("Failed to fetch sites");
  }
  return response.json();
}

export default async function HomePage() {
  const sites = await fetchSites();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-primary">
        Processed Websites
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors cursor-pointer">
          <CardContent className="flex flex-col w-full h-full items-center justify-center">
            <PlusIcon className="size-20 stroke-1" />
            <p>Add Site Pages</p>
          </CardContent>
        </Card>
        {sites?.map((site) => (
          <Link href={`/site/${site.id}`} key={site.id}>
            <Card className="hover:bg-muted transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{site.url}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Total Pages: {site.totalPages}</p>
                <p className="text-sm text-gray-400">
                  Created: {new Date(site.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-400">
                  Updated: {new Date(site.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
