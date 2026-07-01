import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "pos" | "courier";

export interface StaffMember {
  id: number;
  badge: string;
  full_name: string;
  role: StaffRole;
  courier_id: number | null;
}

const STORAGE_KEY = "vsm_staff_session";

interface StaffAuthContextType {
  staff: StaffMember | null;
  loading: boolean;
  signInStaff: (badge: string, password: string) => Promise<{ error: string | null; member?: StaffMember }>;
  signOutStaff: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export const StaffAuthProvider = ({ children }: { children: ReactNode }) => {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setStaff(JSON.parse(raw) as StaffMember);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInStaff = useCallback(async (badge: string, password: string) => {
    const { data, error } = await (supabase as any).rpc("staff_authenticate", {
      p_badge: badge.trim(),
      p_password: password,
    });

    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "Badge ou mot de passe incorrect." };

    const member: StaffMember = {
      id: Number(row.id),
      badge: row.badge,
      full_name: row.full_name,
      role: row.role as StaffRole,
      courier_id: row.courier_id != null ? Number(row.courier_id) : null,
    };

    setStaff(member);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(member));
    return { error: null, member };
  }, []);

  const signOutStaff = useCallback(() => {
    setStaff(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <StaffAuthContext.Provider value={{ staff, loading, signInStaff, signOutStaff }}>
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuth = () => {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error("useStaffAuth must be used within StaffAuthProvider");
  return ctx;
};
