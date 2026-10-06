import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function HousePoints() {
  const [points, setPoints] = useState({
    Suzaku: 0,
    Seiryuu: 0,
    Genbu: 0,
    Byakko: 0,
  });

  const [loading, setLoading] = useState(true);

  const fetchPoints = async () => {
    try {
      const [
        { data: raceData, error: raceError },
        { data: fieldData, error: fieldError },
      ] = await Promise.all([
        supabase
          .from("race_results")
          .select(`
            points,
            student:student_id (
              house
            )
          `),

        supabase
          .from("field_results")
          .select(`
            points,
            student:student_id (
              house
            )
          `),
      ]);

      if (raceError) {
        throw raceError;
      }

      if (fieldError) {
        throw fieldError;
      }

      const totals = {
        Suzaku: 0,
        Seiryuu: 0,
        Genbu: 0,
        Byakko: 0,
      };

      raceData?.forEach((result) => {
        const house = result.student?.house;

        if (house && house in totals) {
          totals[house] += result.points || 0;
        }
      });

      fieldData?.forEach((result) => {
        const house = result.student?.house;

        if (house && house in totals) {
          totals[house] += result.points || 0;
        }
      });

      setPoints(totals);
    } catch (error) {
      console.error("Error fetching house points:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();

    const raceChannel = supabase
      .channel("race_results-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "race_results",
        },
        () => {
          fetchPoints();
        }
      )
      .subscribe();

    const fieldChannel = supabase
      .channel("field_results-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "field_results",
        },
        () => {
          fetchPoints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(raceChannel);
      supabase.removeChannel(fieldChannel);
    };
  }, []);

  if (loading) {
    return (
      <div>
        <h1>Loading house points...</h1>
      </div>
    );
  }

  return (
    <div>
      {Object.entries(points).map(([house, score]) => (
        <div key={house}>
          <h1>
            {house}: {score}
          </h1>
        </div>
      ))}
    </div>
  );
}