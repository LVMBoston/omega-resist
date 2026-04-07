import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function InteractiveTemplates() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate("/deck-management?tab=templates", { replace: true });
  }, [navigate]);

  return null;
}
