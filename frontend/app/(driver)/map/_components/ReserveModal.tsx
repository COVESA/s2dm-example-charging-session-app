"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Modal } from "@/ui/Modal";
import {
  ReserveChargingPointDocument,
  VehiclesDocument
} from "@/graphql/generated/graphql";
import { useUserContext } from "@/contexts/UserContext";
import type { MapStation } from "../_hooks/useChargingStationsQuery";

const PAYMENT_SIMULATION_MS = 2500;
const MOCK_PAYMENTS = [
  { id: "1", brand: "VISA", last4: "4242" },
];

type ChargingPointSelection = {
  pointIndex: number;
};

interface ReserveModalProps {
  station: MapStation;
  onClose: () => void;
  onReservationSuccess?: () => void;
  onSessionChanged?: () => Promise<unknown> | unknown;
  initialChargingPointId?: string | null;
}

function formatPriceShort(centsPerKwh: number): string {
  return `${(centsPerKwh / 100).toFixed(2)} €/kWh`;
}

function formatConnectorLabel(type: string, powerKw: number): string {
  return `${type} · ${Math.round(powerKw)} kW`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </h3>
  );
}

function ConnectorChip({ connector }: { connector: MapStation["chargingPoints"][number]["connectors"][number] }) {
  const tetheredLabel = connector.tethered ? "Cable included" : "Bring cable";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-150 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      {formatConnectorLabel(connector.type, connector.powerKw)}
      <span className="text-slate-300">·</span>
      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 11, lineHeight: 1, display: "inline-flex", alignItems: "center" }} title={tetheredLabel}>
        {connector.tethered ? "power" : "power_off"}
      </span>
    </span>
  );
}

function ChargingPointCard({
  point,
  pointIndex,
  isSelected,
  isSelectable,
  onClick,
}: {
  point: MapStation["chargingPoints"][number];
  pointIndex: number;
  isSelected: boolean;
  isSelectable: boolean;
  onClick?: () => void;
}) {
  const Tag = isSelectable ? "button" : "div";
  return (
    <Tag
      type={isSelectable ? "button" : undefined}
      disabled={isSelectable ? false : undefined}
      onClick={isSelectable ? onClick : undefined}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-all ${
        !isSelectable
          ? "cursor-default border-slate-100 bg-slate-50/50"
          : isSelected
            ? "border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400/40"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-2 w-2 shrink-0 rounded-full ${
            point.availableNow ? "bg-emerald-500" : "bg-amber-400"
          }`}
        />
        <span className="text-sm font-semibold text-slate-800">
          CP {pointIndex + 1}
        </span>
        <span
          className={`text-xs font-medium ${
            point.availableNow ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {point.availableNow ? "Available" : "In use"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {point.connectors.map((connector, i) => (
            <ConnectorChip key={`${connector.type}-${i}`} connector={connector} />
          ))}
        </div>
        {isSelectable && (
          <span
            className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              isSelected
                ? "border-emerald-500 bg-emerald-500"
                : "border-slate-300"
            }`}
          >
            {isSelected && (
              <span className="material-symbols-outlined text-[11px] font-bold text-white">
                check
              </span>
            )}
          </span>
        )}
      </div>
    </Tag>
  );
}

export function ReserveModal({
  station,
  onClose,
  onReservationSuccess,
  onSessionChanged,
  initialChargingPointId
}: ReserveModalProps) {
  const { selectedUser } = useUserContext();
  const [selectedPaymentId] = useState(MOCK_PAYMENTS[0]?.id ?? "");

  const [selection, setSelection] = useState<ChargingPointSelection | null>(() => {
    if (initialChargingPointId) {
      const index = station.chargingPoints.findIndex(cp => cp.id === initialChargingPointId);
      if (index !== -1) return { pointIndex: index };
    }
    return null;
  });

  useEffect(() => {
    if (initialChargingPointId) {
      const index = station.chargingPoints.findIndex(cp => cp.id === initialChargingPointId);
      if (index !== -1) setSelection({ pointIndex: index });
    }
  }, [initialChargingPointId, station.chargingPoints]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  const { data: vehiclesData } = useQuery(VehiclesDocument, {
    variables: { userId: selectedUser?.id ?? "" },
    skip: !selectedUser?.id
  });

  const vehicles = vehiclesData?.vehicles ?? [];
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  useEffect(() => {
    if (vehicles.length > 0 && !vehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  const [reserveMutation] = useMutation(ReserveChargingPointDocument, {
    refetchQueries: "active"
  });

  const canConfirm =
    selection !== null &&
    !!selectedUser &&
    !!selectedVehicleId &&
    !isProcessingPayment;

  const handleConfirmReservation = useCallback(async () => {
    if (!canConfirm || !selectedUser || !selectedVehicleId || selection === null)
      return;

    setIsProcessingPayment(true);
    setReservationError(null);

    const chargingPoint = station.chargingPoints[selection.pointIndex];
    if (!chargingPoint) {
      setIsProcessingPayment(false);
      setReservationError("Invalid charging point selection");
      return;
    }

    await new Promise((r) => setTimeout(r, PAYMENT_SIMULATION_MS));

    try {
      const result = await reserveMutation({
        variables: {
          input: {
            userId: selectedUser.id,
            vehicleId: selectedVehicleId,
            stationId: station.id,
            chargingPointId: chargingPoint.id
          }
        }
      });

      const session =
        result.data?.reserveChargingPoint?.session ?? null;
      if (session) {
        await onSessionChanged?.();
        onReservationSuccess?.();
        onClose();
      } else {
        setReservationError("Reservation failed");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reserve charging point";
      setReservationError(message);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    canConfirm,
    selectedUser,
    selectedVehicleId,
    selection,
    station,
    reserveMutation,
    onClose,
    onReservationSuccess,
    onSessionChanged
  ]);

  const handleClose = useCallback(() => {
    setSelection(null);
    setReservationError(null);
    setIsProcessingPayment(false);
    onClose();
  }, [onClose]);

  const handleSelectPoint = useCallback((pointIndex: number) => {
    setSelection({ pointIndex });
  }, []);

  const payment = MOCK_PAYMENTS.find((p) => p.id === selectedPaymentId);

  return (
    <Modal isOpen={true} onClose={handleClose} titleId="reserve-modal-title" maxWidth="md">
        <>
          {/* ── Header ── */}
          <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
            <div className="flex items-start justify-between">
              <h2
                id="reserve-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Reserve a Charging Point
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Pricing & availability */}
            <div>
              <SectionLabel>Pricing</SectionLabel>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-base">bolt</span>
                  {formatPriceShort(station.priceCentsPerKwh)}
                </span>
                {!initialChargingPointId && (
                  <span className="text-[13px] text-slate-400">
                    {station.availableNowPoints} of {station.totalPoints} available
                  </span>
                )}
              </div>
            </div>

            {!selectedUser && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-base">info</span>
                Select a user in the navbar to continue.
              </div>
            )}

            {/* Charging point selection */}
            <div>
              <SectionLabel>
                {initialChargingPointId ? "Charging Point" : "Select Charging Point"}
              </SectionLabel>
              <div className="space-y-2">
                {initialChargingPointId && selection ? (
                  (() => {
                    const point = station.chargingPoints[selection.pointIndex];
                    if (!point) return null;
                    return (
                      <ChargingPointCard
                        key={point.id}
                        point={point}
                        pointIndex={selection.pointIndex}
                        isSelected
                        isSelectable={false}
                      />
                    );
                  })()
                ) : (
                  station.chargingPoints
                    .filter((cp) => !cp.outOfService)
                    .map((point) => {
                      const pointIndex = station.chargingPoints.indexOf(point);
                      const isSelectable = point.availableNow;
                      return (
                        <ChargingPointCard
                          key={point.id}
                          point={point}
                          pointIndex={pointIndex}
                          isSelected={selection?.pointIndex === pointIndex}
                          isSelectable={isSelectable}
                          onClick={() => isSelectable && handleSelectPoint(pointIndex)}
                        />
                      );
                    })
                )}
              </div>
            </div>

            {/* Vehicle & Payment */}
            <div>
              <SectionLabel>Vehicle</SectionLabel>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                  directions_car
                </span>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  disabled={!selectedUser || vehicles.length === 0}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 transition-colors hover:border-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                >
                  {vehicles.length > 0 ? (
                    vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model}
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {selectedUser ? "No vehicles" : "Select user first"}
                    </option>
                  )}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                  expand_more
                </span>
              </div>
            </div>

            <div>
              <SectionLabel>Payment</SectionLabel>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md bg-[#1a1f71] text-[11px] font-bold tracking-wide text-white">
                  {payment?.brand ?? "—"}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">
                    •••• {payment?.last4 ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400">
                    Credit card
                  </span>
                </div>
                <span className="material-symbols-outlined ml-auto text-base text-emerald-400">
                  check_circle
                </span>
              </div>
            </div>

            {reservationError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-base">error</span>
                {reservationError}
              </div>
            )}
          </div>

          {/* ── Footer: CTA ── */}
          <div className="shrink-0 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirmReservation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessingPayment ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">
                    progress_activity
                  </span>
                  Processing payment…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">bolt</span>
                  Confirm Reservation
                </>
              )}
            </button>
          </div>
        </>
    </Modal>
  );
}
