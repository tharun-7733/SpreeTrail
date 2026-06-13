import { redirect } from "next/navigation";

export default async function GroupIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/group/${id}/expenses`);
}
