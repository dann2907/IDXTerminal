import { useEffect } from "react";
import IDXTerminal from "./components/IDXTerminal";
import { useMarketStore } from "./stores/useMarketStore";

export default function App() {
  const initWebSocket = useMarketStore(s => s.initWebSocket);

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  return <IDXTerminal />;
}