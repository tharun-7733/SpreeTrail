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

      <Card className="glass-card border-0 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500"></div>
        <CardHeader className="pt-8 pb-6 text-center">
          <div className="w-16 h-16 mx-auto bg-violet-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <span className="text-3xl">✨</span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Create a new group</CardTitle>
          <CardDescription className="text-base mt-2">
            Give your group a name — you can invite friends right after!
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} id="new-group-form" className="space-y-6">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 shadow-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="group-name" className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Group name <span className="text-red-500">*</span>
              </label>
              <Input
                id="group-name"
                placeholder="e.g. Goa Trip 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="h-12 text-lg bg-gray-50/50 border-gray-200 focus-visible:ring-violet-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="group-description" className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Description <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <Input
                id="group-description"
                placeholder="A short description of this group"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-12 bg-gray-50/50 border-gray-200 focus-visible:ring-violet-500"
              />
            </div>

            <Button 
              id="create-group-submit" 
              type="submit" 
              className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 border-0" 
              disabled={loading}
            >
              {loading ? "Creating…" : "Create group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
