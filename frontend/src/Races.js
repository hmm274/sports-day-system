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
            no_result,
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
    <div>
      <h2>All Races</h2>
      <ul>
        {races.map((race) => (
          <li key={race.race_id}>
            <h3>
              {race.race_event} (Race ID: {race.race_id})
            </h3>
            {race.race_results && race.race_results.length > 0 ? (
              <ul>
                {race.race_results.map((result) => (
                  <li key={result.result_id}>
                    {result.students.first_name} {result.students.last_name} |{" "}
                    Grade {result.students.grade} | {result.students.sex} |{" "}
                    House: {result.students.house}{" "}
                    {!result.no_result ? `| Time: ${result.time}` : "| No Result"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No students assigned yet.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}