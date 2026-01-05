import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Races() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRaces = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("races")
        .select(`
          race_id,
          race_event,
          race_results (
            race_id,
            student_id,
            lane,
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
              {race.race_event}
            </h3>
            <table>
              <thead>
                <th>Lane</th>
                <th>Name</th>
                <th>Grade</th>
                <th>Sex</th>
                <th>House</th>
                <th>Time</th>
              </thead>
              {race.race_results && race.race_results.length > 0 ? (
                <tbody>
                  {race.race_results.map((result) => (
                    <tr key={result.result_id}>
                      <td>{result.lane}</td>
                      <td>{result.students.first_name} {result.students.last_name}</td>
                      <td>{result.students.grade}</td>
                      <td>{result.students.sex}</td>
                      <td>{result.students.house}</td>
                      <td>{!result.no_result ? result.time : "No Result"}</td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <p>No students assigned yet.</p>
              )}
            </table>
          </li>
        ))}
      </ul>
    </div>
  );
}