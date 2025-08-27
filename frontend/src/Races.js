import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Races() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRaces = async () => {
      setLoading(true);

      // Fetch races and join race_results → students
      const { data, error } = await supabase
        .from("races")
        .select(`
          race_id,
          race_event,
          race_results (
            race_id,
            student_id,
            time,
            students (
              student_id,
              first_name,
              last_name,
              grade,
              sex,
              house
            )
          )
        `)
        .order("race_id", { ascending: true });

      if (error) {
        console.error("Error fetching races:", error);
        setRaces([]);
      } else {
        setRaces(data || []);
      }
      setLoading(false);
    };

    fetchRaces();
  }, []);

  if (loading) return <p>Loading races...</p>;
  if (races.length === 0) return <p>No races set yet.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">All Races</h2>
      <ul className="space-y-4">
        {races.map((race) => (
          <li
            key={race.race_id}
            className="p-4 bg-gray-100 rounded-lg shadow-md"
          >
            <h3 className="font-semibold text-lg mb-2">
              {race.race_event} (Race ID: {race.race_id})
            </h3>
            {race.race_results && race.race_results.length > 0 ? (
              <ul className="pl-4 space-y-1">
                {race.race_results.map((result) => (
                  <li key={result.result_id} className="text-sm">
                    {result.students.first_name} {result.students.last_name} |{" "}
                    Grade {result.students.grade} | {result.students.sex} |{" "}
                    House: {result.students.house}{" "}
                    {result.time ? `| Time: ${result.time}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No students assigned yet.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}