import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchPost, type Post } from "../../services/postService";
import PostCard from "../../components/PostCard";
import Icon from "../../components/ui/Icon";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => { if (user && id) fetchPost(user.id, id).then(setPost); }, [user, id]);
  if (!user) return null;
  if (post === undefined) return <PageLoader />;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="grid grid-cols-[44px_1fr_44px] items-center">
        <button onClick={() => nav(-1)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100"><Icon name="arrowLeft" size={22} /></button>
        <h1 className="text-center font-display text-xl font-semibold">Post</h1><span />
      </div>
      {post ? <PostCard post={post} me={user.id} onDeleted={() => nav("/dashboard")} /> : (
        <EmptyState icon="image" title="Post not available" text="It may have been deleted."
          action={<Link to="/dashboard" className="text-sm font-medium text-brand-700">Back to feed</Link>} />
      )}
    </div>
  );
}
