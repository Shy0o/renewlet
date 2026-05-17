import { useEffect, useState } from "react";
import { pb, type RecordModel } from "@/lib/pocketbase";

export type SessionData = {
  session: { id: string };
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    banned: boolean;
  };
};

function toSessionData(record: RecordModel | null | undefined): SessionData | null {
  if (!pb.authStore.isValid || !record) return null;
  return {
    session: { id: pb.authStore.token },
    user: {
      id: record.id,
      email: typeof record["email"] === "string" ? record["email"] : "",
      name: typeof record["name"] === "string" ? record["name"] : "",
      role: typeof record["role"] === "string" ? record["role"] : "user",
      banned: Boolean(record["banned"]),
    },
  };
}

function getCurrentSession(): SessionData | null {
  return toSessionData(pb.authStore.record);
}

export const authClient = {
  useSession() {
    const [data, setData] = useState<SessionData | null>(() => getCurrentSession());
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
      const unsubscribe = pb.authStore.onChange(() => {
        setData(getCurrentSession());
        setIsPending(false);
      }, true);
      return unsubscribe;
    }, []);

    return { data, isPending };
  },

  signIn: {
    async email({ email, password }: { email: string; password: string }) {
      try {
        await pb.collection("users").authWithPassword(email, password);
        return { data: getCurrentSession(), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },

  async signOut() {
    pb.authStore.clear();
  },
};
