import { ForecastTabs } from "./ForecastTabs";

export default function ForecastLayout({ children }: LayoutProps<"/admin/forecast">) {
  return (
    <div className="flex flex-col pt-2">
      <ForecastTabs />
      {children}
    </div>
  );
}
