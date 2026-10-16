import {
  TiWeatherCloudy,
  TiWeatherDownpour,
  TiWeatherPartlySunny,
  TiWeatherShower,
  TiWeatherStormy,
  TiWeatherSunny,
} from "react-icons/ti";
import { BsQuestion } from "react-icons/bs";
import AustraliaFlag from "../../../assets/flags/au.svg";
import FranceFlag from "../../../assets/flags/fr.svg";
import ChinaFlag from "../../../assets/flags/cn.svg";
import BahrainFlag from "../../../assets/flags/bh.svg";
import SpainFlag from "../../../assets/flags/es.svg";
import MonacoFlag from "../../../assets/flags/mc.svg";
import CanadaFlag from "../../../assets/flags/ca.svg";
import UnitedKingdomFlag from "../../../assets/flags/gb.svg";
import GermanyFlag from "../../../assets/flags/de.svg";
import HungaryFlag from "../../../assets/flags/hu.svg";
import BelgiumFlag from "../../../assets/flags/be.svg";
import ItalyFlag from "../../../assets/flags/it.svg";
import SingaporeFlag from "../../../assets/flags/sg.svg";
import JapanFlag from "../../../assets/flags/jp.svg";
import UAEFlag from "../../../assets/flags/ae.svg";
import USAFlag from "../../../assets/flags/us.svg";
import BrazilFlag from "../../../assets/flags/br.svg";
import AustriaFlag from "../../../assets/flags/at.svg";
import RussiaFlag from "../../../assets/flags/ru.svg";
import MexicoFlag from "../../../assets/flags/mx.svg";
import AzerbaijanFlag from "../../../assets/flags/az.svg";
import VietnamFlag from "../../../assets/flags/vn.svg";
import NetherlandsFlag from "../../../assets/flags/nl.svg";

export function getTrackFlag(trackName?: string) {
  switch (trackName) {
    case "Melbourne":
      return AustraliaFlag;
    case "Paul Ricard":
      return FranceFlag;
    case "Shanghai":
      return ChinaFlag;
    case "Sakhir":
    case "Sakhir (Short)":
      return BahrainFlag;
    case "Catalunya":
      return SpainFlag;
    case "Monaco":
      return MonacoFlag;
    case "Montreal":
      return CanadaFlag;
    case "Silverstone":
    case "Silverstone (Short)":
      return UnitedKingdomFlag;
    case "Hockenheim":
      return GermanyFlag;
    case "Hungaroring":
      return HungaryFlag;
    case "Spa":
      return BelgiumFlag;
    case "Monza":
      return ItalyFlag;
    case "Singapore":
      return SingaporeFlag;
    case "Suzuka":
    case "Suzuka (Short)":
      return JapanFlag;
    case "Abu Dhabi":
      return UAEFlag;
    case "Texas":
    case "Texas (Short)":
      return USAFlag;
    case "Brazil":
      return BrazilFlag;
    case "Austria":
      return AustriaFlag;
    case "Sochi":
      return RussiaFlag;
    case "Mexico":
      return MexicoFlag;
    case "Baku":
      return AzerbaijanFlag;
    case "Hanoi":
      return VietnamFlag;
    case "Zandvoort":
      return NetherlandsFlag;
    default:
      return AustraliaFlag;
  }
}

export function getWeatherIcon(sessionWeather: string) {
  switch (sessionWeather) {
    case "Clear":
      return TiWeatherSunny;
    case "Light Cloud":
      return TiWeatherPartlySunny;
    case "Overcast":
      return TiWeatherCloudy;
    case "Light Rain":
      return TiWeatherShower;
    case "Heavy Rain":
      return TiWeatherDownpour;
    case "Storm":
      return TiWeatherStormy;
    default:
      return BsQuestion;
  }
}
