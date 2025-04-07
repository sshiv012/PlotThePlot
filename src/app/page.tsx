"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Graph = dynamic(() => import("@/components/GraphVisualizer"), {
  ssr: false,
});

export default function Home() {
  type ValidationResult = {
    known_story: boolean;
    score: number;
    notes: string;
    issues: string[];
  };

  const [jsonData, setJsonData] = useState(null);
  const [bookId, setBookId] = useState("");
  const [validate, setValidate] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);   const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setError("");
    setLoading(true);
    setJsonData(null);

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5328";
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ book_id: parseInt(bookId), validate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API request failed");
      }

      const data = await res.json();
      setJsonData(data);
      if (data.validation) {
        setValidation(data.validation);
      } else {
        setValidation(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">PlotThePlot Visualizer</h1>

      <Card className="p-4 mb-6 space-y-4">
        <h2 className="text-xl font-semibold">Analyze a Book from Project Gutenberg</h2>
        <Input
          type="number"
          placeholder="Enter Gutenberg Book ID (e.g., 16)"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        />
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={validate}
            onChange={(e) => setValidate(e.target.checked)}
          />
          <span>Validate output</span>
        </label>
        <Button onClick={handleAnalyze} disabled={!bookId || loading}>
          {loading ? "Analyzing..." : "Analyze"}
        </Button>
        {error && <div className="text-red-500">❌ {error}</div>}
      </Card>

      {jsonData && (
        <div className="border rounded-xl p-4 bg-white shadow">
          <Graph data={jsonData} />
        </div>
      )}
      {validation && (
        <div className="mt-6 p-4 rounded-lg bg-gray-50 border shadow">
          <h2 className="text-xl font-semibold mb-2">Validation Summary</h2>
          <p>
            <strong>Familiar with Story:</strong>{" "}
            <span className={validation.known_story ? "text-green-600" : "text-red-600"}>
              {validation.known_story ? "Yes" : "No"}
            </span>
          </p>
          <p className="mt-2">
            <strong>Score:</strong> {validation.score} / 10
          </p>
          <p className="mt-2">
            <strong>Notes:</strong> {validation.notes}
          </p>
          {validation.issues.length > 0 ? (
            <div className="mt-2">
              <strong>Issues:</strong>
              <ul className="list-disc pl-6 text-sm">
                {validation.issues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-green-700">No major issues found.</p>
          )}
        </div>
      )}
    </main>
  );
}