import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // adjust path if needed

export default function HousePoints() {
  const [points, setPoints] = useState({
    Suzaku: 0,
    Seiryuu: 0,
    Genbu: 0,
    Byakko: 0,
  });

  const fetchPoints = async () => {
    const { data: raceData, error: raceError } = await supabase
      .from("race_results")
      .select(`
        points,
        student:student_id (
          house
        )
      `);

    const {data: fieldData,error: fieldError} = await supabase
      .from("field_results")
      .select(`
        points,
        student:student_id (
          house
        )
      `);

    if (raceError) {
      console.error("Error fetching points:", raceError);
      return;
    }
    if(fieldError){
      console.error("Error fetching points: ", fieldError);
    }

    const totals = { Suzaku: 0, Seiryuu: 0, Genbu: 0, Byakko: 0 };

    raceData?.forEach((result) => {
      if (result.student?.house) {
        totals[result.student.house] += result.points || 0;
      }
    });
    fieldData?.forEach((result)=>{
      if(result.student?.house){
        totals[result.student.house]+=result.points || 0;
      }
    })

    setPoints(totals);
  };

  useEffect(() => {
    fetchPoints();

    // Subscribe to realtime changes in race_results
    const raceChannel = supabase
      .channel("race_results-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "race_results" },
        () => {
          fetchPoints(); // refresh on insert/update/delete
        }
      )
      .subscribe();

    const fieldChannel = supabase
      .channel("field_results-changes")
      .on(
        "postgres_changes",
        { event:"*", schema:"public", table:"field_results"},
        ()=>{
          fetchPoints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(raceChannel);
      supabase.removeChannel(fieldChannel);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {Object.entries(points).map(([house, score]) => (
        <div
          key={house}
          className="p-4 bg-white rounded-2xl shadow-md flex justify-between items-center"
        >
          <span className="font-bold text-lg">{house}: </span>
          <span className="text-xl">{score}</span>
        </div>
      ))}
    </div>
  );
}