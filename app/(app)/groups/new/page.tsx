"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.groups.create({ name, description }) as any;
      router.push(`/group/${data.group.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
        id="new-group-back-link"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create a new group</CardTitle>
          <CardDescription>
            Give your group a name — you can add members after creating it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} id="new-group-form" className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="group-name" className="text-sm font-medium text-gray-700">
                Group name <span className="text-red-500">*</span>
              </label>
              <Input
                id="group-name"
                placeholder="Goa Trip 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="group-description" className="text-sm font-medium text-gray-700">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                id="group-description"
                placeholder="A short description of this group"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button id="create-group-submit" type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
