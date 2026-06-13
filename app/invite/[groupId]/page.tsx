"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Shield, ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function InvitePage({ params }: { params: Promise<{ groupId: string }> }) {
  const router = useRouter();
  const { groupId } = use(params);
  
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (!res.ok) {
          setError("Group not found or invite link is invalid.");
        } else {
          const data = await res.json();
          setGroup(data);
        }
      } catch (err) {
        setError("Failed to load group details.");
      } finally {
        setLoading(false);
      }
    }
    
    // Quick check to see if user has a token cookie
    // This is a rough client-side check. Real validation happens on the backend.
    const hasToken = document.cookie.includes("token=");
    setIsAuthenticated(hasToken);
    
    fetchGroup();
  }, [groupId]);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: "POST",
      });
      
      if (res.ok) {
        router.push(`/group/${groupId}`);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to join group.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-gray-200 mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full border-0 shadow-xl overflow-hidden glass-card">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
            <p className="text-gray-500 mb-6">{error}</p>
            <Link href="/">
              <Button className="w-full">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      {/* Decorative background orbs */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <Card className="max-w-md w-full border-0 shadow-2xl overflow-hidden relative z-10 glass-card">
        <div className="h-32 bg-gradient-to-r from-violet-600 to-indigo-600 relative">
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center text-violet-600">
            <UserPlus className="w-8 h-8" />
          </div>
        </div>
        
        <CardContent className="pt-12 pb-8 px-8 text-center">
          <p className="text-sm font-medium text-violet-600 mb-1 uppercase tracking-wider">You've been invited!</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{group?.name}</h1>
          {group?.description && (
            <p className="text-gray-500 text-sm mb-4">{group.description}</p>
          )}
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 py-2 px-4 rounded-full inline-flex mb-8 border border-gray-100">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{group?._count?.members || group?.members?.length || 0} members</span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {isAuthenticated ? (
            <Button 
              className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 bg-gradient-to-r from-violet-600 to-indigo-600" 
              onClick={handleJoin} 
              disabled={joining}
            >
              {joining ? "Joining..." : "Join Group"}
            </Button>
          ) : (
            <div className="space-y-3">
              <Link href="/register">
                <Button className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 bg-gradient-to-r from-violet-600 to-indigo-600">
                  Sign up to Join
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full h-12 text-gray-600 border-gray-200 hover:bg-gray-50">
                  Log in
                </Button>
              </Link>
              <p className="text-xs text-gray-400 mt-4">You need an account to join and track expenses.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
