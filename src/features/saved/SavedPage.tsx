import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchSavedPosts, type Post } from "../../services/postService";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import Icon from "../../components/ui/Icon";

export default function SavedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => { if (user) fetchSavedPosts(user.id).then(setPosts); }, [user]);
  if (!posts) return <PageLoader />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-semibold">Saved posts</h1>
      {posts.length === 0 ? <EmptyState icon="bookmark" title="Nothing saved yet" text="Tap the bookmark on any post to keep it here." /> : (
        <div className="grid grid-cols-3 gap-1">
          {posts.map((x) => (
            <Link key={x.id} to={`/post/${x.id}`} className="relative aspect-square overflow-hidden bg-stone-200">
              {x.images[0] && <img src={x.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />}
              {x.images.length > 1 && <Icon name="grid" size={16} className="absolute right-1.5 top-1.5 text-white drop-shadow" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
