import { Checkbox, Drawer } from "@mui/joy";
import clsx from "clsx";
import dayjs from "dayjs";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DropletIcon,
  FilterIcon,
  FlaskConicalIcon,
  LeafIcon,
  PillIcon,
  SproutIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import ActivityCalendar from "@/components/ActivityCalendar";
import { ANIMAL_NICKNAMES } from "@/store/v1/rawData";
import { PetMemoWithData } from "./Pet";

interface GroupedCareEvent {
  timestamp: Date;
  types: Set<string>;
  plants: Map<string, { nickname: string; species: string }>;
}

interface CareEventsProps {
  petMemosWithData: PetMemoWithData[];
}

const careEventTypes = {
  watering: { label: "Watering", icon: DropletIcon, color: "text-blue-600 dark:text-blue-400" },
  fertilizing: { label: "Fertilizing", icon: LeafIcon, color: "text-green-600 dark:text-green-400" },
  acidSupplement: { label: "Acid Supplement", icon: FlaskConicalIcon, color: "text-yellow-600 dark:text-yellow-400" },
  ironSupplement: { label: "Iron Supplement", icon: PillIcon, color: "text-orange-600 dark:text-orange-400" },
  rootingPowderUse: { label: "Rooting Powder", icon: SproutIcon, color: "text-purple-600 dark:text-purple-400" },
};

const CareEvents = ({ petMemosWithData }: CareEventsProps) => {
  const [currentMonth = dayjs().format("YYYY-MM"), setCurrentMonth] = useLocalStorage(
    "care-events-current-month",
    dayjs().format("YYYY-MM"),
  );
  const [selectedNicknames, setSelectedNicknames] = useState<string[]>([]);
  const [selectedEventTypes = [], setSelectedEventTypesBase] = useLocalStorage<string[]>("care-events-selected-event-types", []);
  const setSelectedEventTypes = (value: string[] | ((prev: string[]) => string[])) => {
    if (typeof value === "function") {
      const current = selectedEventTypes ?? [];
      setSelectedEventTypesBase(value(current));
    } else {
      setSelectedEventTypesBase(value);
    }
  };
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [activeQuickFilter = null, setActiveQuickFilter] = useLocalStorage<number | "this-month" | "last-month" | null>(
    "care-events-active-quick-filter",
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [hasInitializedNicknames, setHasInitializedNicknames] = useState(false);

  // Parse all care events from petMemosWithData (filter out animals)
  // Group events by timestamp - events with the same timestamp are treated as one event
  const allEvents = useMemo(() => {
    const eventMap = new Map<string, GroupedCareEvent>();

    petMemosWithData.forEach(({ petData }) => {
      // Filter out animals
      if (petData.nickname && ANIMAL_NICKNAMES.includes(petData.nickname)) return;

      if (petData.careEvents) {
        const petNickname = petData.nickname || "";
        const petSpecies = petData.species || "";
        const plantKey = `${petNickname}|${petSpecies}`;

        Object.entries(petData.careEvents).forEach(([eventType, timestamps]) => {
          const timestampArray = Array.isArray(timestamps) ? timestamps : timestamps ? [timestamps] : [];

          timestampArray.forEach((ts) => {
            try {
              const timestamp = new Date(ts);
              if (!isNaN(timestamp.getTime())) {
                const timeKey = timestamp.toISOString();

                if (!eventMap.has(timeKey)) {
                  eventMap.set(timeKey, {
                    timestamp,
                    types: new Set(),
                    plants: new Map(),
                  });
                }

                const event = eventMap.get(timeKey)!;
                event.types.add(eventType);
                if (!event.plants.has(plantKey)) {
                  event.plants.set(plantKey, { nickname: petNickname, species: petSpecies });
                }
              }
            } catch (e) {
              console.error("Error parsing timestamp:", ts, e);
            }
          });
        });
      }
    });

    return Array.from(eventMap.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [petMemosWithData]);

  // Get unique plant nicknames (excluding animals)
  const plantNicknames = useMemo(() => {
    const nicknames = new Set<string>();
    petMemosWithData.forEach(({ petData }) => {
      if (petData.nickname && !ANIMAL_NICKNAMES.includes(petData.nickname)) {
        nicknames.add(petData.nickname);
      }
    });
    return Array.from(nicknames).sort();
  }, [petMemosWithData]);

  // Set default selected nicknames to all plants on mount (only once)
  useEffect(() => {
    if (!hasInitializedNicknames && plantNicknames.length > 0 && selectedNicknames.length === 0) {
      setSelectedNicknames(plantNicknames);
      setHasInitializedNicknames(true);
    }
  }, [plantNicknames, selectedNicknames, hasInitializedNicknames]);

  // Helper function to calculate date range from quick filter value
  const calculateDateRange = (filterValue: number | "this-month" | "last-month") => {
    const today = dayjs();
    if (filterValue === "this-month") {
      return {
        start: today.startOf("month").format("YYYY-MM-DD"),
        end: today.endOf("month").format("YYYY-MM-DD"),
      };
    } else if (filterValue === "last-month") {
      return {
        start: today.subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
        end: today.subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
      };
    } else {
      return {
        start: today.subtract(filterValue - 1, "day").format("YYYY-MM-DD"),
        end: today.format("YYYY-MM-DD"),
      };
    }
  };

  // Restore date filter from persisted activeQuickFilter on mount
  useEffect(() => {
    if (activeQuickFilter !== null) {
      setDateRange(calculateDateRange(activeQuickFilter));
    }
  }, []); // Only run on mount

  // Filter events based on selected filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // Filter by nickname - event must have at least one matching plant
      if (selectedNicknames.length > 0) {
        const hasMatchingPlant = Array.from(event.plants.values()).some((plant) => selectedNicknames.includes(plant.nickname));
        if (!hasMatchingPlant) return false;
      }

      // Filter by event type - event must have at least one matching type
      if (selectedEventTypes.length > 0) {
        const hasMatchingType = selectedEventTypes.some((type) => event.types.has(type));
        if (!hasMatchingType) return false;
      }

      // Filter by selected date
      if (selectedDate) {
        const eventDate = dayjs(event.timestamp).format("YYYY-MM-DD");
        if (eventDate !== selectedDate) return false;
      }

      // Filter by date range
      if (dateRange) {
        const eventDate = dayjs(event.timestamp).format("YYYY-MM-DD");
        if (eventDate < dateRange.start || eventDate > dateRange.end) return false;
      }

      return true;
    });
  }, [allEvents, selectedNicknames, selectedEventTypes, selectedDate, dateRange]);

  // Build activity data for calendar view
  const calendarActivityData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredEvents.forEach((event) => {
      const dateKey = dayjs(event.timestamp).format("YYYY-MM-DD");
      data[dateKey] = (data[dateKey] || 0) + 1;
    });
    return data;
  }, [filteredEvents]);

  const handlePrevMonth = () => {
    setCurrentMonth(dayjs(currentMonth).subtract(1, "month").format("YYYY-MM"));
  };

  const handleNextMonth = () => {
    setCurrentMonth(dayjs(currentMonth).add(1, "month").format("YYYY-MM"));
  };

  const isCurrentMonth = currentMonth >= dayjs().format("YYYY-MM");

  const handleNicknameToggle = (nickname: string) => {
    setSelectedNicknames((prev) => (prev.includes(nickname) ? prev.filter((n) => n !== nickname) : [...prev, nickname]));
  };

  const handleEventTypeToggle = (eventType: string) => {
    setSelectedEventTypes((prev) => {
      const current = prev || [];
      return current.includes(eventType) ? current.filter((t) => t !== eventType) : [...current, eventType];
    });
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setDateRange(null);
    setActiveQuickFilter(null);
  };

  const handleQuickDateFilter = (days: number | "this-month" | "last-month") => {
    setSelectedDate(null);
    setActiveQuickFilter(days);
    setDateRange(calculateDateRange(days));
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
    setDateRange(null);
    setActiveQuickFilter(null);
  };

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (event.type === "keydown" && ((event as React.KeyboardEvent).key === "Tab" || (event as React.KeyboardEvent).key === "Shift")) {
      return;
    }
    setDrawerOpen(open);
  };

  const toggleEventExpansion = (eventIndex: number) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventIndex)) {
        newSet.delete(eventIndex);
      } else {
        newSet.add(eventIndex);
      }
      return newSet;
    });
  };

  // Count active filters
  const activeFilterCount = selectedNicknames.length + selectedEventTypes.length + (selectedDate || dateRange ? 1 : 0);

  // Get date filter display text
  const getDateFilterText = () => {
    if (selectedDate) {
      return dayjs(selectedDate).format("YYYY-MM-DD");
    }
    if (dateRange) {
      return `${dayjs(dateRange.start).format("MM-DD")} ~ ${dayjs(dateRange.end).format("MM-DD")}`;
    }
    return null;
  };

  // Handle select all plants
  const handleSelectAllPlants = () => {
    if (selectedNicknames.length === plantNicknames.length) {
      setSelectedNicknames([]);
    } else {
      setSelectedNicknames([...plantNicknames]);
    }
  };

  // Handle select all event types
  const handleSelectAllEventTypes = () => {
    const allEventTypes = Object.keys(careEventTypes);
    if (selectedEventTypes.length === allEventTypes.length) {
      setSelectedEventTypes([]);
    } else {
      setSelectedEventTypes(allEventTypes);
    }
  };

  // Render filter content (shared between desktop and mobile drawer)
  const renderFilterContent = () => (
    <div className="space-y-3">
      {/* Plant Nickname Filter */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Plants</div>
          {plantNicknames.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              <Checkbox
                checked={selectedNicknames.length === plantNicknames.length}
                indeterminate={selectedNicknames.length > 0 && selectedNicknames.length < plantNicknames.length}
                onChange={handleSelectAllPlants}
                size="sm"
                color="primary"
                sx={{ padding: 0, "--Checkbox-size": "1rem" }}
              />
              <span>全选</span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {plantNicknames.map((nickname) => (
            <label
              key={nickname}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ring-1 ring-inset",
                selectedNicknames.includes(nickname)
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-white dark:bg-zinc-800 ring-gray-200 dark:ring-zinc-700 text-gray-600 dark:text-gray-400 hover:ring-gray-300 dark:hover:ring-zinc-600",
              )}
            >
              <Checkbox
                checked={selectedNicknames.includes(nickname)}
                onChange={() => handleNicknameToggle(nickname)}
                size="sm"
                color="primary"
                sx={{ padding: 0, "--Checkbox-size": "1rem" }}
              />
              <span>{nickname}</span>
            </label>
          ))}
          {plantNicknames.length === 0 && <span className="text-xs text-gray-400 dark:text-gray-500">No plants found</span>}
        </div>
      </div>

      {/* Event Type Filter */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Event Types</div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
            <Checkbox
              checked={selectedEventTypes.length === Object.keys(careEventTypes).length}
              indeterminate={selectedEventTypes.length > 0 && selectedEventTypes.length < Object.keys(careEventTypes).length}
              onChange={handleSelectAllEventTypes}
              size="sm"
              color="primary"
              sx={{ padding: 0, "--Checkbox-size": "1rem" }}
            />
            <span>全选</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(careEventTypes).map(([eventType, config]) => {
            const Icon = config.icon;
            return (
              <label
                key={eventType}
                title={config.label}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ring-1 ring-inset",
                  selectedEventTypes.includes(eventType)
                    ? "bg-primary/10 text-primary ring-primary/20"
                    : "bg-white dark:bg-zinc-800 ring-gray-200 dark:ring-zinc-700 text-gray-600 dark:text-gray-400 hover:ring-gray-300 dark:hover:ring-zinc-600",
                )}
              >
                <Checkbox
                  checked={selectedEventTypes.includes(eventType)}
                  onChange={() => handleEventTypeToggle(eventType)}
                  size="sm"
                  color="primary"
                  sx={{ padding: 0, "--Checkbox-size": "1rem" }}
                />
                <Icon className="w-3.5 h-3.5" />
              </label>
            );
          })}
        </div>
      </div>

      {/* Date Filter */}
      <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
        {/* Header with Quick Filter Options */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Date</div>
          <button
            onClick={() => handleQuickDateFilter(7)}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-all",
              activeQuickFilter === 7
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
            )}
          >
            7d
          </button>
          <button
            onClick={() => handleQuickDateFilter(14)}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-all",
              activeQuickFilter === 14
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
            )}
          >
            14d
          </button>
          <button
            onClick={() => handleQuickDateFilter(30)}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-all",
              activeQuickFilter === 30
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
            )}
          >
            30d
          </button>
          <button
            onClick={() => handleQuickDateFilter("this-month")}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-all",
              activeQuickFilter === "this-month"
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
            )}
          >
            This M
          </button>
          <button
            onClick={() => handleQuickDateFilter("last-month")}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-all",
              activeQuickFilter === "last-month"
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700",
            )}
          >
            Last M
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-4 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-700 dark:text-gray-300">{dayjs(currentMonth).format("MMM YYYY")}</span>
              {/* Active Date Filter Display */}
              {getDateFilterText() && (
                <button
                  onClick={handleClearDateFilter}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 hover:opacity-80 transition-all"
                  title={`Clear filter: ${getDateFilterText()}`}
                >
                  <span>{getDateFilterText()}</span>
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-all"
                onClick={handlePrevMonth}
                title="Previous month"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={handleNextMonth}
                disabled={isCurrentMonth}
                title={isCurrentMonth ? "Cannot navigate to future months" : "Next month"}
              >
                <ChevronRightIcon className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>
          <ActivityCalendar
            month={currentMonth}
            selectedDate={selectedDate || ""}
            data={calendarActivityData}
            onClick={handleDateClick}
            getTooltipText={(date, count) => (count ? `${count} care events on ${date}` : date)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Mobile Filter Summary - visible only on small screens */}
      <div className="block md:hidden">
        <button
          onClick={toggleDrawer(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-md border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
        >
          <div className="flex items-center gap-1.5">
            <FilterIcon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1 py-0.5 text-xs rounded-full bg-primary/10 text-primary">{activeFilterCount}</span>
              )}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {selectedNicknames.length > 0 && `${selectedNicknames.length} plant${selectedNicknames.length > 1 ? "s" : ""}`}
            {selectedNicknames.length > 0 && selectedEventTypes.length > 0 && " · "}
            {selectedEventTypes.length > 0 && `${selectedEventTypes.length} type${selectedEventTypes.length > 1 ? "s" : ""}`}
            {(selectedNicknames.length > 0 || selectedEventTypes.length > 0) && (selectedDate || dateRange) && " · "}
            {selectedDate && dayjs(selectedDate).format("MMM D")}
            {dateRange && `${dayjs(dateRange.start).format("MMM D")} ~ ${dayjs(dateRange.end).format("MMM D")}`}
          </div>
        </button>
      </div>

      {/* Desktop Filter Bar - hidden on small screens */}
      <div className="hidden md:block">{renderFilterContent()}</div>

      {/* Mobile Drawer */}
      <Drawer anchor="right" size="md" open={drawerOpen} onClose={toggleDrawer(false)}>
        <div className="w-full h-full px-4 py-4 bg-zinc-100 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            <button onClick={toggleDrawer(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-all">
              <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          {renderFilterContent()}
        </div>
      </Drawer>

      {/* Events List */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="w-full p-8 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 text-center">
            <p className="text-gray-500 dark:text-gray-400">No care events found matching the selected filters.</p>
          </div>
        ) : (
          filteredEvents.map((event, idx) => {
            const plants = Array.from(event.plants.values());
            const types = Array.from(event.types);

            return (
              <div
                key={idx}
                className="flex flex-col gap-2 px-3 py-2 bg-white dark:bg-zinc-900 rounded-md border border-gray-200 dark:border-zinc-700"
              >
                {/* Top part: Timestamp and Event Type Icons */}
                <div className="flex items-center gap-2">
                  {/* Timestamp */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {dayjs(event.timestamp).format("YYYY-MM-DD HH:mm")}
                  </div>

                  {/* Event Type Icons */}
                  <div className="flex gap-1">
                    {types.map((type) => {
                      const eventConfig = careEventTypes[type as keyof typeof careEventTypes];
                      const Icon = eventConfig?.icon || DropletIcon;
                      return (
                        <div key={type} className={clsx("p-1.5 rounded bg-gray-50 dark:bg-zinc-800")}>
                          <Icon className={clsx("w-3.5 h-3.5", eventConfig?.color)} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom part: Plants */}
                <div className="flex flex-wrap gap-1">
                  {plants.slice(0, expandedEvents.has(idx) ? plants.length : 10).map((plant, plantIdx) => {
                    const displayName =
                      plant.nickname && plant.species ? `${plant.nickname} | ${plant.species}` : plant.nickname || plant.species;
                    return (
                      <div
                        key={plantIdx}
                        className="flex items-center px-1.5 py-1 rounded bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      >
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-none">{displayName}</span>
                      </div>
                    );
                  })}
                  {plants.length > 10 && (
                    <button
                      onClick={() => toggleEventExpansion(idx)}
                      className="flex items-center px-1.5 py-1 rounded bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 hover:opacity-80 transition-all"
                    >
                      <span className="text-xs font-medium leading-none">
                        {expandedEvents.has(idx) ? `Hide ${plants.length - 10}` : `+${plants.length - 10} more`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CareEvents;
