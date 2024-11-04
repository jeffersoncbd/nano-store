/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { createContext, useContext, useReducer } from "react";

export function initState<State>(initialState: State) {

    type SideEffectHandler<P> = (
        state: State,
        payload: P
    ) => void;
    type SideEffect<T extends string, SEP = undefined> = {
        type: `${T}`,
        reducer: SideEffectHandler<SEP>,
        action: SEP extends undefined ? { type: `${T}` } : { type: `${T}`; payload: SEP }
    }
    type ReducerHandler<P, SEP = undefined> = (
        store: {
            state: State,
            sideEffect: (payload: SEP) => void
        },
        payload: P
    ) => void;
    type Reducer<T extends string, P, SE = undefined, SEP = undefined> = {
        type: `${T}`,
        reducer: ReducerHandler<P, SEP>,
        sideEffect: SE
    }

    function createReducer<T extends string, P>(
        type: `${T}`,
        reducer: ReducerHandler<P>,
    ): {
        action: P extends undefined ? { type: `${T}` } : { type: `${T}`; payload: P };
        reducer: Reducer<T, P>;
    } {
        return {
            action: { type, payload: null } as unknown as P extends undefined
                ? { type: `${T}` }
                : { type: `${T}`; payload: P },
            reducer: { type, reducer, sideEffect: undefined },
        };
    }

    function createReducerWithSideEffect<T extends string, P, SEP>(
        type: `${T}`,
        sideEffect: SideEffectHandler<SEP>,
        reducer: ReducerHandler<P, SEP>,
    ): {
        action: P extends undefined ? { type: `${T}` } : { type: `${T}`; payload: P };
        reducer: Reducer<T, P, SideEffect<T, SEP>, SEP>
    } {
        return {
            action: { type, payload: null } as unknown as P extends undefined
                ? { type: `${T}` }
                : { type: `${T}`; payload: P },
            reducer: {
                type,
                reducer,
                sideEffect: {
                    type,
                    reducer: sideEffect,
                    action: { type, payload: null } as unknown as SEP extends undefined
                        ? { type: `${T}` }
                        : { type: `${T}`; payload: SEP },
                }
            },
        };
    }

    function mountStore<
        R extends { type: string, reducer: ReducerHandler<any, any> },
        A extends { type: string },
        SE extends { type: string, reducer: SideEffectHandler<any> }
    >(
        reducers: R[],
        actions: A[],
        sideEffects: SE[]
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        type Actions = typeof actions[number]

        const StoreContext = createContext<{
            state: State;
            dispatch: React.Dispatch<Actions>;
        }>({
            state: initialState,
            dispatch: () => undefined,
        });

        function useStoreActions() {
            const { dispatch } = useContext(StoreContext);
            return (action: Actions) => dispatch(action);
        }

        function useStoreSelects<T>(query: (state: State) => T): T {
            const { state } = useContext(StoreContext);
            return query(state);
        }

        const reducersMap: Record<string, ReducerHandler<any>> = {};
        const sideEffectsMap: Record<string, SideEffectHandler<any>> = {};
        reducers.forEach((r) => {
            reducersMap[r.type] = r.reducer;
        });
        sideEffects.forEach((se) => {
            sideEffectsMap[`side-effect-${se.type}`] = se.reducer;
        });

        const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
            const [state, dispatch] = useReducer((state: State, action: Actions): State => {
                const newState = structuredClone(state)
                if (!action.type.startsWith('side-effect-')) {
                    reducersMap[action.type]({
                        state, sideEffect: (payload) => {
                            dispatch({ type: `side-effect-${action.type}`, payload } as unknown as Actions)
                        }
                    }, (action as unknown as any).payload)
                } else {
                    sideEffectsMap[action.type](newState, (action as unknown as any).payload)
                }
                return newState
            }, initialState);
            return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
        };
        return { StoreProvider, useStoreActions, useStoreSelects }
    }
    return { createReducer, createReducerWithSideEffect, mountStore }
}
