import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "client" | "ambassador";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isAmbassador: boolean;
  /** Recharge les rôles depuis la base (utile après connexion). */
  refreshRoles: () => Promise<AppRole[]>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setRolesLoading(true);
          setRoles([]);
          setTimeout(() => {
            void fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setRoles([]);
          setRolesLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error && (error as any).code === "refresh_token_not_found") {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setUser(null);
        setRoles([]);
        setRolesLoading(false);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setRolesLoading(true);
        setRoles([]);
        await fetchUserRoles(session.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string): Promise<AppRole[]> => {
    setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      if (error) throw error;
      const next = data?.map(r => r.role as AppRole) || [];
      setRoles(next);
      return next;
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRoles([]);
      return [];
    } finally {
      setRolesLoading(false);
    }
  };

  const refreshRoles = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.user) {
      setRoles([]);
      setRolesLoading(false);
      return [];
    }
    return fetchUserRoles(s.user.id);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const isAdmin = roles.includes("admin");
  const isAmbassador = roles.includes("ambassador");

  return (
    <AuthContext.Provider value={{
      user, session, loading, rolesLoading, roles, isAdmin, isAmbassador,
      refreshRoles, signUp, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
