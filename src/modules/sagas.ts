import { all } from 'redux-saga/effects'
import { raceSaga } from './race/sagas'

export function* rootSaga() {
    yield all([
        raceSaga(),
    ])
}
