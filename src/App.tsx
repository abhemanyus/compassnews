import DeckGL from "@deck.gl/react";
import Map from "react-map-gl/maplibre";
import { useEffect, useState } from 'react'
import './App.css'
import supabase from './config/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Session } from '@supabase/supabase-js';
import { IconLayer, MapViewState } from "deck.gl";

const map_style = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.41669,
  latitude: 37.7853,
  zoom: 13
};

async function createReport(location: number[]) {
  await supabase
    .from("reports")
    .insert([{
      description: "straight from deck.gl",
      location_name: "no idea",
      location: `POINT(${location[0]} ${location[1]})`
    }]);
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [reports, setReports] = useState<{ description: string | null, long: number, lat: number }[]>([]);

  function fetchLocations(viewport: number[]) {
    supabase.rpc("reports_in_view", { bounds: viewport })
      .then(({ data }) => { setReports(data) })
  }

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation([position.coords.longitude, position.coords.latitude]);
    },
      (error) => {
        console.error(error);
      }
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    setViewState(state => ({
      ...state,
      longitude: location[0],
      latitude: location[1]
    }));
  }, [location]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    })

    return () => subscription.unsubscribe();
  }, []);

  const reportLayer = new IconLayer({
    id: "report_layer",
    data: reports,
    getPosition: (report) => [report.long, report.lat],
    getSize: 40,
    getIcon: () => "marker",
    iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
    iconMapping: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json',
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 0]
  });

  return (
    !session ?
      <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
      :
      <DeckGL
        initialViewState={viewState}
        layers={[reportLayer]}
        onClick={(info) => {
          if (info.coordinate) {
            createReport(info.coordinate).then(() => {
              fetchLocations(info.viewport?.getBounds() || []);
            }).catch(console.error);
          }
        }}
        onDragEnd={(info) => {
          fetchLocations(info.viewport?.getBounds() || []);
        }}
        getTooltip={info => info.object ? info.object.description : undefined }
        getCursor={(state) => {
          if (state.isDragging) return "grab"
          else if (state.isHovering) return "pointer"
          else return "crosshair"
        }}
        controller
      >
        <Map
          initialViewState={viewState}
          mapStyle={map_style}
        />
      </DeckGL>

  )
}

export default App
